"""PLAT-V1-TASK-011 integration tests: `POST /api/dashboard/widgets/generate`
SSE pipeline against the real docker stack (Postgres + Redis).

Gate order (m2-delta.md §3): budget -> resolver -> registry -> fetch. The
resolver/CE client are DI-faked via `app.dependency_overrides` (Law F, same
seam `test_dashboard_widgets_api.py` uses for `get_ce_metrics_client`) --
only the budget gate itself runs against real Postgres settings + Redis, so
`test_budget_gate_blocks_before_model_call` is real proof, not a mock of
the thing under test.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.billing import metering
from weave_backend.billing.caps import BUDGET_CAP_KEY
from weave_backend.billing.gate import BudgetCapReached
from weave_backend.billing.metering import consumed_key
from weave_backend.billing.period import current_period
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.dashboard.generate import DASHBOARD_BUDGET_WORKSPACE_ID
from weave_backend.dashboard.intent import (
    ProviderUnavailable,
    SourceNotGA,
    get_dashboard_agent_resolver,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.schemas.dashboard import WidgetSpec
from weave_backend.settings.resolver import set_setting
from weave_backend.settings.scope import company_iri
from weave_backend.tenancy.sessions import get_redis

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_OK_SPEC = WidgetSpec(
    component_type="kpi_card",
    title="Entities in model",
    data_source_contracts=["CE-METRICS-1"],
    bindings={"field": "entity_count_by_kind"},
    column_span=2,
)


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _ce_metrics_stub(body: dict[str, object], *, status_code: int = 200) -> AsyncClient:
    async def _handler(request: Request) -> Response:
        return Response(status_code=status_code, json=body)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def _resolver_ok(prompt: str) -> WidgetSpec:
    return _OK_SPEC


async def _resolver_provider_down(prompt: str) -> WidgetSpec:
    raise ProviderUnavailable("no provider configured")


def _parse_sse(text: str) -> list[tuple[str, dict[str, object]]]:
    events = []
    for block in text.strip().split("\n\n"):
        if not block:
            continue
        event_line, data_line = block.splitlines()
        events.append(
            (event_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: ")))
        )
    return events


async def _generate(
    client: AsyncClient, tokens: object, prompt: str = "how many entities"
) -> list[tuple[str, dict[str, object]]]:
    async with client.stream(
        "POST",
        "/api/dashboard/widgets/generate",
        json={"prompt": prompt},
        headers={"Authorization": f"Bearer {tokens.access_token}"},  # type: ignore[attr-defined]
    ) as response:
        assert response.status_code == 200
        body = await response.aread()
    return _parse_sse(body.decode())


async def test_budget_gate_blocks_before_model_call(client: AsyncClient) -> None:
    """AC-1: the pre-call budget gate runs against the *real* cascade-
    resolved cap + Redis consumption -- before the resolver is ever called.
    A resolver spy proves zero calls happen on this path (gate order).
    """
    tenant_id = _unique_tenant("dash-gen-budget")
    tokens = await issue_token_pair(sub="u-gen-budget", tenant_id=tenant_id)

    async with tenant_connection(tenant_id) as conn:
        await set_setting(
            conn,
            tenant_id=tenant_id,
            key=BUDGET_CAP_KEY,
            scope_iri=company_iri(tenant_id),
            value=5.0,
        )
    redis = get_redis()
    await redis.set(consumed_key(tenant_id, DASHBOARD_BUDGET_WORKSPACE_ID, current_period()), "5.0")

    resolver_calls = 0

    async def _spy_resolver(prompt: str) -> WidgetSpec:
        nonlocal resolver_calls
        resolver_calls += 1
        return _OK_SPEC

    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _spy_resolver
    events = await _generate(client, tokens)

    assert resolver_calls == 0
    assert [e for e, _ in events] == ["error"]
    assert events[0][1]["state"] == "budget_cap"


async def test_sse_order_invariant(client: AsyncClient) -> None:
    """AC-2: exactly one `spec` event, then `data`, then a terminal `done`
    carrying `token_count` -- the default (flag-off) grammar.
    """
    tenant_id = _unique_tenant("dash-gen-order")
    tokens = await issue_token_pair(sub="u-gen-order", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )

    events = await _generate(client, tokens)

    assert [e for e, _ in events] == ["spec", "data", "done"]
    token_count = events[-1][1]["token_count"]
    assert isinstance(token_count, int)
    assert token_count > 0


async def test_spec_event_latency_or_provisional_fallback(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-3: with the deploy-time fallback flag on, a provisional
    keyword-table spec streams first, immediately replaced by the real
    resolved spec -- same "spec" event grammar, no client change.
    """
    monkeypatch.setattr("weave_backend.dashboard.generate.USE_PROVISIONAL_SPEC_FALLBACK", True)
    tenant_id = _unique_tenant("dash-gen-fallback")
    tokens = await issue_token_pair(sub="u-gen-fallback", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )

    events = await _generate(client, tokens, prompt="show me entities")

    assert [e for e, _ in events] == ["spec", "spec", "data", "done"]
    provisional, real = events[0][1], events[1][1]
    assert provisional["title"] == "Entities in model"
    assert real == _OK_SPEC.model_dump()


async def test_midstream_cap_halts_and_rolls_back(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-5: a budget cap reached mid-loop (2nd `enforce_budget` call, the
    per-chunk recheck) raises `MidStreamCap`'s underlying rollback -- the
    just-inserted widget row never survives the transaction.
    """
    call_count = {"n": 0}

    async def _fake_enforce_budget(conn: object, redis: object, scope: object) -> None:
        call_count["n"] += 1
        if call_count["n"] >= 2:
            raise BudgetCapReached(effective_cap_usd=5.0, consumed_usd=5.0, retry_after="soon")

    monkeypatch.setattr("weave_backend.dashboard.generate.enforce_budget", _fake_enforce_budget)
    tenant_id = _unique_tenant("dash-gen-midcap")
    tokens = await issue_token_pair(sub="u-gen-midcap", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )

    events = await _generate(client, tokens)

    assert [e for e, _ in events] == ["spec", "error"]
    assert events[-1][1]["state"] == "budget_cap"
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch("SELECT id FROM widget_instances WHERE tenant_id = $1", tenant_id)
    assert rows == []


async def test_provider_503_named_state(client: AsyncClient) -> None:
    """AC-4: the AI provider being down is its own named terminal state,
    distinct from every other error."""
    tenant_id = _unique_tenant("dash-gen-503")
    tokens = await issue_token_pair(sub="u-gen-503", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_provider_down

    events = await _generate(client, tokens)

    assert [e for e, _ in events] == ["error"]
    assert events[0][1]["state"] == "provider_503"


@pytest.mark.parametrize(
    ("resolver_result", "expected_state"),
    [
        (SourceNotGA(source_engine="build"), "source_not_ga"),
        (None, "unsatisfiable"),
    ],
)
async def test_non_ga_category_distinct_from_unsatisfiable(
    client: AsyncClient, resolver_result: object, expected_state: str
) -> None:
    """AC-6: "category real but engine dark" (`source_not_ga`) and "no
    component/data-shape match" (`unsatisfiable`) are deliberately distinct
    terminal states -- never conflated (Design Decisions table Blocker).
    """

    async def _resolver(prompt: str) -> object:
        return resolver_result

    tenant_id = _unique_tenant("dash-gen-ga")
    tokens = await issue_token_pair(sub="u-gen-ga", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver

    events = await _generate(client, tokens)

    assert [e for e, _ in events] == ["error"]
    assert events[0][1]["state"] == expected_state
    if expected_state == "source_not_ga":
        assert events[0][1]["reason"] == "build"


async def test_generation_metered_and_audited(client: AsyncClient) -> None:
    """AC-7: a successful generation writes a hash-chained audit entry
    (prompt HASH only, never raw prompt text) and drives real metering."""
    tenant_id = _unique_tenant("dash-gen-audit")
    tokens = await issue_token_pair(sub="u-gen-audit", tenant_id=tenant_id)
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )

    events = await _generate(client, tokens, prompt="secret raw prompt text")
    assert events[-1][0] == "done"

    if metering._background_tasks:
        await asyncio.gather(*list(metering._background_tasks))

    async with tenant_connection(tenant_id) as conn:
        audit_rows = await conn.fetch(
            "SELECT diff_summary FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'dashboard.widget.generated'",
            tenant_id,
        )
        usage_rows = await conn.fetch(
            "SELECT * FROM billing_usage WHERE tenant_id = $1 AND record_type = 'token_usage'",
            tenant_id,
        )
    assert len(audit_rows) == 1
    diff_summary = json.loads(audit_rows[0]["diff_summary"])
    assert diff_summary["prompt_hash"] != "secret raw prompt text"
    assert "secret raw prompt text" not in json.dumps(diff_summary)
    assert len(usage_rows) == 1
