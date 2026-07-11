"""PLAT-V1-TASK-013 integration tests: refine/restore/history against the
real docker stack (Postgres + Redis) -- mirrors
`test_dashboard_generate_api.py`'s fixtures/conventions exactly (Law F:
resolver/CE client DI-faked, only budget gate + storage are real).
"""

from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.billing import metering
from weave_backend.billing.caps import BUDGET_CAP_KEY
from weave_backend.billing.metering import consumed_key
from weave_backend.billing.period import current_period
from weave_backend.dashboard import store
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.dashboard.generate import DASHBOARD_BUDGET_WORKSPACE_ID
from weave_backend.dashboard.intent import ProviderUnavailable, get_dashboard_agent_resolver
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
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not available"),
]

_OK_SPEC = WidgetSpec(
    component_type="bar_chart",
    title="Entities by kind",
    data_source_contracts=["CE-METRICS-1"],
    bindings={"field": "entity_count_by_kind"},
    column_span=6,
    data_shape="categorical",
)

_REFINED_SPEC = WidgetSpec(
    component_type="bar_chart",
    title="Entities by kind, last 30 days",
    data_source_contracts=["CE-METRICS-1"],
    bindings={"field": "entity_count_by_kind"},
    column_span=6,
    data_shape="categorical",
)


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    oidc_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=oidc_transport, base_url="http://mock-oidc"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _ce_metrics_stub(payload: dict[str, object], status_code: int = 200) -> AsyncClient:
    async def _handler(request: Request) -> Response:
        return Response(status_code, json=payload)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def _resolver_ok(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
    return _REFINED_SPEC


async def _resolver_provider_down(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
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


async def _seed_widget(
    tenant_id: str, owner_principal_iri: str, spec: WidgetSpec = _OK_SPEC
) -> str:
    async with tenant_connection(tenant_id) as conn:
        return await store.insert_generated_widget(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_principal_iri, spec=spec
        )


async def _refine(
    client: AsyncClient, tokens: object, widget_id: str, prompt: str = "last 30 days instead"
) -> list[tuple[str, dict[str, object]]]:
    async with client.stream(
        "POST",
        f"/api/dashboard/widgets/{widget_id}/refine",
        json={"prompt": prompt},
        headers={"Authorization": f"Bearer {tokens.access_token}"},  # type: ignore[attr-defined]
    ) as response:
        assert response.status_code == 200
        body = await response.aread()
        return _parse_sse(body.decode())


async def test_refine_reuses_generate_pipeline(client: AsyncClient) -> None:
    """AC-1: budget cap blocks refine before any resolver call (proves the
    gate is in the refine path), and a happy refine is metered + audited as
    `dashboard.widget.refined` -- both via TASK-011's real machinery.
    """
    tenant_id = _unique_tenant("dash-refine-budget")
    tokens = await issue_token_pair(sub="u-refine-budget", tenant_id=tenant_id)
    widget_id = await _seed_widget(tenant_id, f"urn:weave:tenant:{tenant_id}:human:u-refine-budget")

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

    resolver_calls = {"n": 0}

    async def _spy(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
        resolver_calls["n"] += 1
        return _REFINED_SPEC

    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _spy

    events = await _refine(client, tokens, widget_id)

    assert resolver_calls["n"] == 0
    assert events[-1][0] == "error"
    assert events[-1][1]["state"] == "budget_cap"

    # Happy path: metered + audited as the refine-specific event type.
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )
    async with tenant_connection(tenant_id) as conn:
        await set_setting(
            conn,
            tenant_id=tenant_id,
            key=BUDGET_CAP_KEY,
            scope_iri=company_iri(tenant_id),
            value=500.0,
        )
    events = await _refine(client, tokens, widget_id)
    assert [e for e, _ in events] == ["spec", "data", "done"]

    if metering._background_tasks:
        await asyncio.gather(*list(metering._background_tasks))

    async with tenant_connection(tenant_id) as conn:
        audit_rows = await conn.fetch(
            "SELECT event_type FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'dashboard.widget.refined'",
            tenant_id,
        )
        usage_rows = await conn.fetch(
            "SELECT * FROM billing_usage WHERE tenant_id = $1 AND record_type = 'token_usage'",
            tenant_id,
        )
    assert len(audit_rows) == 1
    assert len(usage_rows) == 1


async def test_refinement_history_capped_at_10(client: AsyncClient) -> None:
    """AC-2: 12 successive refines leave exactly 10 rows, the latest 10 seqs."""
    tenant_id = _unique_tenant("dash-refine-cap")
    tokens = await issue_token_pair(sub="u-refine-cap", tenant_id=tenant_id)
    widget_id = await _seed_widget(tenant_id, f"urn:weave:tenant:{tenant_id}:human:u-refine-cap")
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )

    for i in range(12):
        events = await _refine(client, tokens, widget_id, prompt=f"refine step {i}")
        assert events[-1][0] == "done"

    resp = await client.get(
        f"/api/dashboard/widgets/{widget_id}/history",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    steps = resp.json()["steps"]
    assert len(steps) == 10
    assert [s["seq"] for s in steps] == list(range(3, 13))


async def test_refine_failure_preserves_prior_state(client: AsyncClient) -> None:
    """AC-3: a provider_503 mid-refine leaves spec/last_result/history
    byte-identical to before the attempt -- no write occurs on any error
    path (structural, by the transaction shape).
    """
    tenant_id = _unique_tenant("dash-refine-fail")
    tokens = await issue_token_pair(sub="u-refine-fail", tenant_id=tenant_id)
    widget_id = await _seed_widget(tenant_id, f"urn:weave:tenant:{tenant_id}:human:u-refine-fail")
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )
    ok_events = await _refine(client, tokens, widget_id, prompt="first refine")
    assert ok_events[-1][0] == "done"

    async with tenant_connection(tenant_id) as conn:
        before = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
        history_before = await conn.fetch(
            "SELECT step FROM widget_refinements WHERE tenant_id = $1 AND widget_instance_id = $2",
            tenant_id,
            widget_id,
        )
    assert before is not None

    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_provider_down
    fail_events = await _refine(client, tokens, widget_id, prompt="second refine, fails")
    assert [e for e, _ in fail_events] == ["error"]
    assert fail_events[0][1]["state"] == "provider_503"

    async with tenant_connection(tenant_id) as conn:
        after = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
        history_after = await conn.fetch(
            "SELECT step FROM widget_refinements WHERE tenant_id = $1 AND widget_instance_id = $2",
            tenant_id,
            widget_id,
        )
    assert after is not None
    assert after.spec == before.spec
    assert after.last_result == before.last_result
    assert len(history_after) == len(history_before)


async def test_history_restore_no_model_call(client: AsyncClient) -> None:
    """AC-4: restoring an earlier step swaps the spec and re-fetches data
    (CE client called) but never calls the resolver/model.
    """
    tenant_id = _unique_tenant("dash-refine-restore")
    tokens = await issue_token_pair(sub="u-refine-restore", tenant_id=tenant_id)
    widget_id = await _seed_widget(
        tenant_id, f"urn:weave:tenant:{tenant_id}:human:u-refine-restore"
    )
    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _resolver_ok
    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )
    events = await _refine(client, tokens, widget_id, prompt="split by severity")
    assert events[-1][0] == "done"

    resolver_calls = {"n": 0}

    async def _spy(prompt: str, context: WidgetSpec | None = None) -> WidgetSpec:
        resolver_calls["n"] += 1
        return _REFINED_SPEC

    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _spy

    resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/restore",
        json={"seq": 1},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["spec"]["component_type"] == "bar_chart"
    assert body["status"] == "fresh"
    assert resolver_calls["n"] == 0

    async with tenant_connection(tenant_id) as conn:
        row = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
    assert row is not None
    assert row.spec.title == _OK_SPEC.title


async def test_refine_unsatisfiable_declines(client: AsyncClient) -> None:
    """AC-6: a delta the resolver can't match declines with `unsatisfiable`
    and preserves the widget's prior state.
    """
    tenant_id = _unique_tenant("dash-refine-unsat")
    tokens = await issue_token_pair(sub="u-refine-unsat", tenant_id=tenant_id)
    widget_id = await _seed_widget(tenant_id, f"urn:weave:tenant:{tenant_id}:human:u-refine-unsat")

    async def _decline(prompt: str, context: WidgetSpec | None = None) -> None:
        return None

    app.dependency_overrides[get_dashboard_agent_resolver] = lambda: _decline

    events = await _refine(
        client, tokens, widget_id, prompt="break down by a field the contract lacks"
    )

    assert [e for e, _ in events] == ["error"]
    assert events[0][1]["state"] == "unsatisfiable"

    async with tenant_connection(tenant_id) as conn:
        row = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
    assert row is not None
    assert row.spec == _OK_SPEC


async def test_refine_forbidden_on_tenant_default(client: AsyncClient) -> None:
    """DoD: `tenant_default` is read-only-composed at M2 -- refine 403s
    rather than the IDOR-safe-404 shape PATCH/DELETE use (API Contracts:
    "403 non-owner/user-scope, 404 unknown id").
    """
    tenant_id = _unique_tenant("dash-refine-default")
    tokens = await issue_token_pair(sub="u-refine-default", tenant_id=tenant_id)
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="tenant_default", owner_principal_iri=None
        )
    widget_id = rows[0].id

    resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/refine",
        json={"prompt": "last 30 days instead"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 403


async def test_refine_unknown_widget_is_404(client: AsyncClient) -> None:
    """API Contracts: unknown id -> 404 (distinct from the 403 above)."""
    tenant_id = _unique_tenant("dash-refine-404")
    tokens = await issue_token_pair(sub="u-refine-404", tenant_id=tenant_id)

    resp = await client.post(
        f"/api/dashboard/widgets/{uuid.uuid4()}/refine",
        json={"prompt": "last 30 days instead"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 404
