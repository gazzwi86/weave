"""AC-1/AC-2/AC-5/AC-6: `PUT /api/billing/caps`, `GET /api/billing/usage`.

`simulate-ai-call`/`simulate-run` (harness-only, no production route wraps
`ai/router.py` yet) live on a separate `harness_router` in this module --
QA blocker (PLAT-TASK-008): `simulate-ai-call` calls the real `ai_route()`
and incurs real billed spend, and RBAC alone (`author` role) is not enough
authorization for that. `harness_router` is mounted in `weave_backend/__init__.py`
only when `WEAVE_ENV` is `dev`/`test`, so a production build never exposes it,
regardless of RBAC.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis

from weave_backend.ai.router import route as ai_route
from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.billing.caps import BUDGET_CAP_KEY, CapExceedsParent, set_cap
from weave_backend.billing.gate import BillingScope, BudgetCapReached, enforce_budget
from weave_backend.billing.metering import (
    TokenUsageRecord,
    build_run_usage_record,
    record_run_usage,
    record_token_usage,
)
from weave_backend.billing.usage import get_usage_summary
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import enforce_workspace_role, is_tenant_admin
from weave_backend.schemas.billing import (
    SetCapRequest,
    SetCapResponse,
    SimulateAiCallRequest,
    UsageSummaryResponse,
    WorkspaceUsageResponse,
)
from weave_backend.settings.scope import InvalidScopeIri, tenant_of, workspace_of
from weave_backend.tenancy.sessions import get_redis

router = APIRouter(prefix="/api/billing", tags=["billing"])
harness_router = APIRouter(prefix="/api/billing", tags=["billing-harness"])


def _require_own_tenant_scope(principal: Principal, scope_iri: str) -> None:
    try:
        iri_tenant_id = tenant_of(scope_iri)
    except InvalidScopeIri as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_scope_iri"}) from exc
    if iri_tenant_id != principal.tenant_id:
        raise HTTPException(status_code=403, detail={"error": "tenant_mismatch"})


@router.put("/caps", response_model=SetCapResponse)
async def set_cap_route(
    body: SetCapRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SetCapResponse:
    _require_own_tenant_scope(principal, body.scope_iri)
    async with tenant_connection(principal.tenant_id) as conn:
        # Budget caps are a financial control, not a config value -- "admin"
        # ceiling (stricter than settings' "author"), same reasoning as
        # membership invite/revoke.
        workspace_id = workspace_of(body.scope_iri)
        if workspace_id is not None:
            await enforce_workspace_role(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                user_sub=principal.sub,
                min_role="admin",
            )
        # Company/domain scope has no workspace segment to check membership
        # against (same gap `_require_workspace_role_for_scope` documents in
        # settings.py) -- fall back to "admin in at least one workspace"
        # rather than settings' tenant-match-only, since a company-wide
        # budget cap is a financial control, not a config value.
        elif not await is_tenant_admin(conn, tenant_id=principal.tenant_id, user_sub=principal.sub):
            raise HTTPException(status_code=403, detail={"error": "forbidden"})
        try:
            await set_cap(
                conn,
                tenant_id=principal.tenant_id,
                key=BUDGET_CAP_KEY,
                scope_iri=body.scope_iri,
                value_usd=body.value_usd,
            )
        except CapExceedsParent as exc:
            raise HTTPException(
                status_code=422,
                detail={"error": "cap_exceeds_parent", "parent_cap_usd": exc.parent_cap_usd},
            ) from exc
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="billing.cap.changed",
                actor_iri=principal.principal_iri,
                subject_iri=body.scope_iri,
                payload={"value_usd": body.value_usd},
            ),
        )
    return SetCapResponse(scope_iri=body.scope_iri, value_usd=body.value_usd)


@router.get("/usage", response_model=UsageSummaryResponse)
async def get_usage_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    workspace_id: str | None = None,
) -> UsageSummaryResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        # AC-7: a workspace_id query param scopes the read to that one
        # workspace and requires admin there -- AC-5's tenant-wide read
        # requires tenant admin instead. Same route, two scopes, since the
        # underlying SQL differs only by a WHERE clause.
        if workspace_id is not None:
            await enforce_workspace_role(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                user_sub=principal.sub,
                min_role="admin",
            )
        elif not await is_tenant_admin(conn, tenant_id=principal.tenant_id, user_sub=principal.sub):
            raise HTTPException(status_code=403, detail={"error": "forbidden"})

        summary = await get_usage_summary(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
    return UsageSummaryResponse(
        period=summary.period,
        total_tokens=summary.total_tokens,
        total_runs=summary.total_runs,
        total_cost_usd=summary.total_cost_usd,
        by_workspace=[WorkspaceUsageResponse(**w.__dict__) for w in summary.by_workspace],
        cap_utilisation_pct=summary.cap_utilisation_pct,
    )


async def _check_budget_gate(
    principal: Principal, workspace_id: str
) -> tuple[Redis, BudgetCapReached | None]:
    """Shared by both harness routes: runs the RBAC + pre-call budget check
    on one connection and reports whether the cap was reached, without
    raising inside the `async with` block -- `enforce_budget`'s cap.reached
    notification, dispatched on the same connection just before a
    `BudgetCapReached`, must survive the rejected call, not roll back with
    an exception raised while the transaction is still open.
    """
    redis = get_redis()
    cap_reached: BudgetCapReached | None = None
    async with tenant_connection(principal.tenant_id) as conn:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="author",
        )
        try:
            await enforce_budget(conn, redis, BillingScope(principal.tenant_id, workspace_id))
        except BudgetCapReached as exc:
            cap_reached = exc
    return redis, cap_reached


def _raise_cap_reached(cap_reached: BudgetCapReached) -> None:
    raise HTTPException(
        status_code=429,
        detail={
            "error": "budget_cap_reached",
            "effective_cap_usd": cap_reached.effective_cap_usd,
            "consumed_usd": cap_reached.consumed_usd,
            "retry_after": cap_reached.retry_after,
        },
    ) from cap_reached


@harness_router.post("/simulate-ai-call", status_code=204)
async def simulate_ai_call_route(
    body: SimulateAiCallRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> None:
    """AC-2: the gate runs, and can reject, before `ai_route` (the external
    AI client) is ever called -- proven by
    `test_simulate_ai_call_rejects_without_calling_ai_client` patching
    `ai_route` and asserting zero calls on a 429.
    """
    redis, cap_reached = await _check_budget_gate(principal, body.workspace_id)
    if cap_reached is not None:
        _raise_cap_reached(cap_reached)

    # PR #18 review finding 1: ai_route is a blocking SDK call (same class as
    # dde58ad's STS fix) -- run it off the event loop so one simulated call
    # doesn't stall every other in-flight request for the provider round trip.
    await asyncio.to_thread(ai_route, body.model_tier, "harness simulated call")

    await record_token_usage(
        redis,
        TokenUsageRecord(
            tenant_id=principal.tenant_id,
            workspace_id=body.workspace_id,
            principal_iri=principal.principal_iri,
            model_tier=body.model_tier,
            input_tokens=body.input_tokens,
            output_tokens=body.output_tokens,
            cost_usd=body.cost_usd,
            ts=datetime.now(UTC),
        ),
    )


@harness_router.post("/simulate-run", status_code=204)
async def simulate_run_route(
    workspace_id: str,
    run_id: str,
    status: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> None:
    """ponytail: harness route exercising AC-4 (run metering, 1 unit/run) --
    no production automation-run-completion call site exists yet (Events &
    Actions engine ships later).
    """
    redis = get_redis()
    async with tenant_connection(principal.tenant_id) as conn:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="author",
        )
    record = build_run_usage_record(
        tenant_id=principal.tenant_id, workspace_id=workspace_id, run_id=run_id, status=status
    )
    await record_run_usage(redis, record)
