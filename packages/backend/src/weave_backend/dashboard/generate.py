"""TASK-011: `POST /api/dashboard/widgets/generate` SSE pipeline (ADR-012,
m2-delta.md §3). Gate order is fixed: budget -> resolver -> registry ->
fetch (the registry check lives inside the resolver's own `SourceNotGA`
classification -- see `dashboard/intent.py`). The whole widget-insert +
fetch loop runs inside one `tenant_connection` so a `MidStreamCap` raised
mid-loop unwinds the transaction naturally (AC-5) -- no hand-rolled
rollback (Implementation Hints).
"""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

import redis.asyncio as redis_lib
from httpx import AsyncClient
from opentelemetry import trace

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.billing.gate import BillingScope, BudgetCapReached, enforce_budget
from weave_backend.billing.metering import TokenUsageRecord, record_token_usage
from weave_backend.dashboard import store
from weave_backend.dashboard.ce_metrics import CeMetricsUnavailable
from weave_backend.dashboard.ce_metrics import fetch as fetch_ce_metric
from weave_backend.dashboard.intent import ProviderUnavailable, Resolver, SourceNotGA
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.dashboard import (
    SseDataPayload,
    SseDonePayload,
    SseErrorPayload,
    WidgetSpec,
)

#: The dashboard prompt bar is a tenant-wide feature -- it has no workspace
#: concept (unlike Build-engine runs). ponytail: a fixed sentinel
#: `workspace_id` lets it reuse `BillingScope`/`enforce_budget`/
#: `record_token_usage` verbatim (Design Decisions: "any re-implementation
#: is a review Blocker") -- `resolve_setting`'s ancestor-chain cascade still
#: correctly falls through to the tenant's company-level cap, since it walks
#: by IRI string, not by checking the workspace exists. Upgrade path: give
#: `BillingScope` a real company-scope constructor if a second tenant-wide
#: (non-workspace) caller shows up.
DASHBOARD_BUDGET_WORKSPACE_ID = "_dashboard"

#: AC-7: no real per-token pricing table exists yet (none of TASK-008/012/013
#: define one) -- metering is wired for real here, priced at $0 until a
#: pricing task lands. ponytail.
GENERATION_COST_USD = 0.0


class MidStreamCap(Exception):
    """AC-5: raised inside the widget-insert transaction; the enclosing
    `tenant_connection` context manager rolls the transaction back on any
    exception, so raising this is the entire rollback mechanism.
    """


@dataclass(frozen=True)
class GenerateRequest:
    """Bundles the per-call identity/prompt so `generate_widget_stream`
    stays under Law E's 5-param cap alongside its injected collaborators.
    """

    tenant_id: str
    principal_iri: str
    prompt: str


@dataclass(frozen=True)
class GenerationSpanAttrs:
    """Bundles PRD §2.2's span attributes for `stamp_generation_span` --
    same 5-param-cap reason as `GenerateRequest`.
    """

    prompt: str
    component_type: str
    data_source_contract: str
    token_count: int
    latency_ms: float
    tenant_id: str


def _sse(event: str, payload_json: str) -> str:
    return f"event: {event}\ndata: {payload_json}\n\n"


def _prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()


def _cap_message(exc: BudgetCapReached) -> str:
    return (
        f"Monthly AI budget cap reached (cap resolved at ${exc.effective_cap_usd:.2f}, "
        f"retry after {exc.retry_after})."
    )


def stamp_generation_span(attrs: GenerationSpanAttrs) -> None:
    """AC-7 / PRD §2.2: span attributes on generation completion. PII
    hygiene -- carries `prompt_hash`, never the raw prompt text. Pure
    function over the *current* span so it's unit-testable without a live
    FastAPI request.
    """
    span = trace.get_current_span()
    span.set_attribute("prompt_hash", _prompt_hash(attrs.prompt))
    span.set_attribute("component_type", attrs.component_type)
    span.set_attribute("data_source_contract", attrs.data_source_contract)
    span.set_attribute("token_count", attrs.token_count)
    span.set_attribute("latency_ms", attrs.latency_ms)
    span.set_attribute("tenant_id", attrs.tenant_id)


def _estimate_token_count(payload: object) -> int:
    """ponytail: no real completion token usage exists yet -- the resolver
    (TASK-012) returns a classified spec, not a raw LLM completion with a
    `usage` block. A rough chars/4 heuristic over the fetched payload stands
    in until a real token count is available; `done`/metering/audit all
    carry whatever this returns, consistently.
    """
    return max(1, len(json.dumps(payload)) // 4)


async def _fetch_binding_data(ce_client: AsyncClient, spec: WidgetSpec) -> AsyncIterator[object]:
    """AC-2: CE-METRICS-1 (TASK-010's client) resolves one bound value per
    widget -- so this yields exactly one `data` chunk on success, zero on
    failure (the caller turns a failure into a terminal error, never a
    partial stream).
    """
    value = await fetch_ce_metric(ce_client, spec.bindings)
    yield value


async def generate_widget_stream(
    request: GenerateRequest,
    *,
    resolver: Resolver,
    ce_client: AsyncClient,
    redis: redis_lib.Redis,
) -> AsyncIterator[str]:
    tenant_id = request.tenant_id
    scope = BillingScope(tenant_id, DASHBOARD_BUDGET_WORKSPACE_ID)

    # AC-1: pre-call budget gate -- before any model call.
    async with tenant_connection(tenant_id) as conn:
        try:
            await enforce_budget(conn, redis, scope)
        except BudgetCapReached as exc:
            yield _sse(
                "error",
                SseErrorPayload(state="budget_cap", reason=_cap_message(exc)).model_dump_json(),
            )
            return

    # Resolver classifies (category + data shape); registry-GA-ness is
    # decided inside the resolver itself (m2-delta.md §3 gate order).
    try:
        result = await resolver(request.prompt)
    except ProviderUnavailable:
        yield _sse(
            "error",
            SseErrorPayload(
                state="provider_503", reason="AI provider unavailable"
            ).model_dump_json(),
        )
        return

    if isinstance(result, SourceNotGA):
        yield _sse(
            "error",
            SseErrorPayload(state="source_not_ga", reason=result.source_engine).model_dump_json(),
        )
        return
    if result is None:
        yield _sse(
            "error",
            SseErrorPayload(
                state="unsatisfiable", reason="no matching widget for this prompt"
            ).model_dump_json(),
        )
        return
    spec = result

    yield _sse("spec", spec.model_dump_json())

    start = time.monotonic()
    widget_id: str | None = None
    last_result: object = None
    try:
        async with tenant_connection(tenant_id) as conn:
            widget_id = await store.insert_generated_widget(
                conn,
                tenant_id=tenant_id,
                owner_principal_iri=request.principal_iri,
                spec=spec,
            )
            async for chunk in _fetch_binding_data(ce_client, spec):
                # Budget re-check cadence: once per `data` chunk (Implementation
                # Hints) -- catches another concurrent caller/admin pushing the
                # tenant over cap while this stream is still running.
                await enforce_budget(conn, redis, scope)
                last_result = chunk
                yield _sse("data", SseDataPayload(rows=chunk, partial=False).model_dump_json())
            await store.apply_refresh_result(
                conn,
                tenant_id=tenant_id,
                widget_id=widget_id,
                outcome=store.RefreshOutcome(
                    last_result=last_result, status="fresh", fetched_at=store.utcnow()
                ),
            )
    except BudgetCapReached as exc:
        # AC-5: raising here unwinds `tenant_connection`'s transaction --
        # the widget insert above is rolled back, no partial row survives.
        yield _sse(
            "error",
            SseErrorPayload(state="budget_cap", reason=_cap_message(exc)).model_dump_json(),
        )
        return
    except CeMetricsUnavailable:
        yield _sse(
            "error",
            SseErrorPayload(
                state="unavailable", reason="data source unreachable"
            ).model_dump_json(),
        )
        return

    latency_ms = (time.monotonic() - start) * 1000
    token_count = _estimate_token_count(last_result)

    # AC-7: fire-and-forget durable write, same convention as every other
    # `record_token_usage` call site (routers/billing.py) -- production
    # never awaits the returned task; tests poll for the row instead.
    await record_token_usage(
        redis,
        TokenUsageRecord(
            tenant_id=tenant_id,
            workspace_id=DASHBOARD_BUDGET_WORKSPACE_ID,
            principal_iri=request.principal_iri,
            model_tier="sonnet",
            input_tokens=0,
            output_tokens=token_count,
            cost_usd=GENERATION_COST_USD,
            ts=store.utcnow(),
        ),
    )

    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type="dashboard.widget.generated",
                actor_iri=request.principal_iri,
                subject_iri=f"urn:weave:tenant:{tenant_id}:widget:{widget_id}",
                payload={
                    "prompt_hash": _prompt_hash(request.prompt),
                    "component_type": spec.component_type,
                },
            ),
        )

    stamp_generation_span(
        GenerationSpanAttrs(
            prompt=request.prompt,
            component_type=spec.component_type,
            data_source_contract=spec.data_source_contracts[0],
            token_count=token_count,
            latency_ms=latency_ms,
            tenant_id=tenant_id,
        )
    )

    yield _sse(
        "done", SseDonePayload(token_count=token_count, widget_id=widget_id).model_dump_json()
    )
