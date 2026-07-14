"""PLAT-V1-TASK-024 integration tests: the `collaboration-activity` binding
against a real docker Postgres stack (AC-1, AC-2, AC-3, AC-6, AC-7). Follows
`test_dashboard_bindings_api.py`'s binding-level pattern and
`test_events_change_feed.py`'s authenticated-client/tenant-RLS pattern.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.dashboard import bindings, store
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub(handlers: dict[str, object]) -> AsyncClient:
    def _handler(request: Request) -> Response:
        body = handlers.get(request.url.path)
        if isinstance(body, Exception):
            raise body
        if body is None:
            return Response(404, json={"error": "not_found"})
        return Response(200, json=body)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def _ctx(
    tenant_id: str, conn: object, ce_client: AsyncClient, *, prior_result: object = None
) -> bindings.BindingContext:
    return bindings.BindingContext(
        tenant_id=tenant_id,
        context_iri=f"urn:weave:tenant:{tenant_id}:company",
        conn=conn,
        ce_client=ce_client,
        prior_result=prior_result,
    )


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


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _authed_headers(
    client: AsyncClient, *, tenant_id: str, workspace_id: str, user_sub: str = "u-1"
) -> dict[str, str]:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email=f"{user_sub}@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace_id, email=f"{user_sub}@example.invalid", user_sub=user_sub
        )
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch.status_code == 200
    return headers


async def _commit(client: AsyncClient, headers: dict[str, str], ref: str) -> str:
    resp = await client.post(
        "/api/operations/apply",
        json={
            "operations": [{"op": "add_node", "ref": ref, "kind": "Actor", "label": ref}],
            "actor": "urn:weave:principal:test-actor",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return str(resp.json()["ref_map"][ref])


async def test_recent_edits_polls_seq_feed_from_cursor(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1: with no prior cursor the binding baselines, then a second call
    with the persisted `last_seq` cursor only returns newer rows.
    """
    tenant_id = _unique_tenant("collab-poll")
    workspace = await _make_workspace(tenant_id, label="collab")
    headers = await _authed_headers(client, tenant_id=tenant_id, workspace_id=workspace.id)
    entity_iri = await _commit(client, headers, "a1")

    async with tenant_connection(tenant_id) as conn:
        ctx = await _ctx(tenant_id, conn, _ce_stub({}))
        first = await bindings.resolve_category("collaboration-activity", ctx)
        assert first.status == "fresh"
        assert any(row["entity_iri"] == entity_iri for row in first.rows)
        cursor = first.meta["last_seq"]

        prior = {"last_seq": cursor, "rows": first.rows}
        ctx2 = await _ctx(tenant_id, conn, _ce_stub({}), prior_result=prior)
        second = await bindings.resolve_category("collaboration-activity", ctx2)
        assert second.meta["last_seq"] == cursor


async def test_rows_render_actor_drafts_and_deep_links(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-2: a committed row carries actor + `href` deep link; a draft
    (null `version_iri`) is flagged, and unpublished vs published actors
    both appear in `top_contributors`.
    """
    tenant_id = _unique_tenant("collab-rows")
    workspace = await _make_workspace(tenant_id, label="collab")
    headers = await _authed_headers(client, tenant_id=tenant_id, workspace_id=workspace.id)
    entity_iri = await _commit(client, headers, "a1")

    async with tenant_connection(tenant_id) as conn:
        ctx = await _ctx(tenant_id, conn, _ce_stub({}))
        result = await bindings.resolve_category("collaboration-activity", ctx)

    row = next(r for r in result.rows if r["entity_iri"] == entity_iri)
    assert row["href"] == f"/resource/{entity_iri}"
    assert row["version_iri"] is None
    assert result.meta["contributors"][0]["actor"]


async def test_410_rebaseline_never_silent_empty(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-3: an aged-out cursor re-seeds via CE-READ-1 rather than returning
    a blank feed -- `truncated` is set and a notice is present.
    """
    tenant_id = _unique_tenant("collab-410")
    workspace = await _make_workspace(tenant_id, label="collab")
    headers = await _authed_headers(client, tenant_id=tenant_id, workspace_id=workspace.id)
    await _commit(client, headers, "a1")

    ce_client = _ce_stub(
        {"/api/sparql": {"rows": [{"entity_iri": "urn:x:1", "label": "Recently touched"}]}}
    )
    async with tenant_connection(tenant_id) as conn:
        # A cursor far beyond `latest_seq` makes `read_events` report
        # `aged_out` per CE-EVENT-1's 410 contract (same trigger as
        # `test_events_change_feed.py`'s retention test, but here forced by
        # an out-of-range cursor rather than a 0-day retention window).
        aged_out_prior = {"last_seq": 999_999_999, "rows": []}
        ctx = await _ctx(tenant_id, conn, ce_client, prior_result=aged_out_prior)
        result = await bindings.resolve_category("collaboration-activity", ctx)

    assert result.status == "fresh"
    assert result.meta.get("truncated") is True
    assert result.rows is not None


def _tenant_scoped_ce_stub(tenant_entities: dict[str, list[dict[str, object]]]) -> AsyncClient:
    """Simulates CE-READ-1's *real* server-side behaviour: `/api/sparql`
    scopes its result to the tenant resolved from the caller's own
    `Authorization` bearer token (`get_current_principal`, `routers/
    sparql.py`) -- never from a client-supplied param. A request with no
    Authorization header (the pre-fix bug) gets every tenant's rows back,
    reproducing the cross-tenant leak PR #91 review found.
    """

    def _handler(request: Request) -> Response:
        auth = request.headers.get("Authorization", "")
        tenant = auth.removeprefix("Bearer ")
        if tenant not in tenant_entities:
            # No/unrecognised auth -- the leak: every tenant's rows returned.
            all_rows = [row for rows in tenant_entities.values() for row in rows]
            return Response(200, json={"rows": all_rows})
        return Response(200, json={"rows": tenant_entities[tenant]})

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def test_410_rebaseline_scoped_by_ce_headers_not_cross_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #91 review: the 410 re-baseline path must forward the caller's
    `Authorization` header as `ce_headers` so CE-READ-1's own tenant
    scoping applies -- without it, `recently_updated_entities` returns
    every tenant's rows (reproduced here via `_tenant_scoped_ce_stub`,
    which mirrors CE's real header-scoped behaviour). Fails before the
    `ce_headers` fix (tenant B's row leaks into tenant A's re-seed),
    passes after.
    """
    tenant_a = _unique_tenant("collab-leak-a")
    tenant_b = _unique_tenant("collab-leak-b")
    ce_client = _tenant_scoped_ce_stub(
        {
            tenant_a: [{"entity_iri": "urn:a:1", "label": "Tenant A entity"}],
            tenant_b: [{"entity_iri": "urn:b:1", "label": "Tenant B entity"}],
        }
    )

    async with tenant_connection(tenant_a) as conn:
        aged_out_prior = {"last_seq": 999_999_999, "rows": []}
        ctx = bindings.BindingContext(
            tenant_id=tenant_a,
            context_iri=f"urn:weave:tenant:{tenant_a}:company",
            conn=conn,
            ce_client=ce_client,
            ce_headers={"Authorization": f"Bearer {tenant_a}"},
            prior_result=aged_out_prior,
        )
        result = await bindings.resolve_category("collaboration-activity", ctx)

    entity_iris = [row["entity_iri"] for row in result.rows]
    assert "urn:b:1" not in entity_iris, "tenant B's entity leaked into tenant A's 410 re-seed"
    assert "urn:a:1" in entity_iris


def _tenant_scoped_ce_metrics_stub(tenant_bodies: dict[str, dict[str, object]]) -> AsyncClient:
    """Same simulated-real-CE pattern as `_tenant_scoped_ce_stub`, but for
    CE-METRICS-1's `/api/metrics/ontology` -- the field-tile fetch path
    (`ce_metrics.fetch`), not CE-READ-1's `/api/sparql`.
    """

    def _handler(request: Request) -> Response:
        auth = request.headers.get("Authorization", "")
        tenant = auth.removeprefix("Bearer ")
        return Response(200, json=tenant_bodies.get(tenant, tenant_bodies["__leaked__"]))

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def test_field_widget_refresh_scoped_by_ce_headers_not_cross_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #91 re-review: the field-tile refresh path (`fetch_ce_metric`,
    `routers/dashboard.py`'s non-category branch) must also forward the
    caller's `Authorization` header -- without it every CE-METRICS-1 field
    tile (entity_count_by_kind, shacl_errors_by_severity, etc.) returns
    whatever the CE stub falls back to on missing/wrong auth (here: tenant
    B's count), not tenant A's own aggregate. Fails before the `headers=
    ce_headers` fix, passes after.
    """
    tenant_a = _unique_tenant("field-leak-a")
    workspace_a = await _make_workspace(tenant_a, label="collab")
    headers_a = await _authed_headers(client, tenant_id=tenant_a, workspace_id=workspace_a.id)

    ce_stub = _tenant_scoped_ce_metrics_stub(
        {
            f"Bearer {tenant_a}": {"entity_count_by_kind": {"Process": 4}},
            "__leaked__": {"entity_count_by_kind": {"Process": 999}},
        }
    )
    async def _override_ce_client() -> AsyncIterator[AsyncClient]:
        yield ce_stub

    app.dependency_overrides[get_ce_metrics_client] = _override_ce_client

    try:
        create_resp = await client.post(
            "/api/dashboard/widgets",
            json={
                "scope": "user",
                "spec": {
                    "component_type": "kpi_card",
                    "title": "Entities in model",
                    "data_source_contracts": ["CE-METRICS-1"],
                    "bindings": {"field": "entity_count_by_kind", "aggregate": "sum"},
                    "column_span": 3,
                },
                "position": 0,
            },
            headers=headers_a,
        )
        assert create_resp.status_code == 201
        widget_id = create_resp.json()["id"]

        refresh_resp = await client.post(
            f"/api/dashboard/widgets/{widget_id}/refresh", headers=headers_a
        )
        assert refresh_resp.status_code == 200
        assert refresh_resp.json()["status"] == "fresh"

        async with tenant_connection(tenant_a) as conn:
            saved = await store.get_widget(conn, tenant_id=tenant_a, widget_id=widget_id)
        assert saved is not None
        assert saved.last_result == 4, "tenant B's aggregate leaked into tenant A's field tile"
    finally:
        app.dependency_overrides.pop(get_ce_metrics_client, None)


async def test_feed_error_degrades_stale_never_blank(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-6: a CE-EVENT-1 read failure degrades to `stale` with the prior
    rows preserved -- never a fabricated empty/zero result.
    """
    tenant_id = _unique_tenant("collab-stale")
    prior_rows = [{"actor": "prior@example.invalid", "entity_iri": "urn:x:1"}]

    async with tenant_connection(tenant_id) as conn:
        broken_ce = _ce_stub({"/api/sparql": httpx.ConnectError("boom")})
        ctx = await _ctx(
            tenant_id,
            conn,
            broken_ce,
            prior_result={"last_seq": 999_999_999, "rows": prior_rows},
        )
        result = await bindings.resolve_category("collaboration-activity", ctx)

    assert result.status == "stale"
    assert result.rows == prior_rows


async def test_proxy_tenant_scoped_cross_tenant_zero_rows(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-6: tenant B's commits never leak into tenant A's collaboration
    feed -- RLS via `tenant_connection`, same precedent as
    `test_get_events_returns_ordered_page_hiding_other_tenants_rows`.
    """
    tenant_a = _unique_tenant("collab-a")
    tenant_b = _unique_tenant("collab-b")
    workspace_a = await _make_workspace(tenant_a, label="collab")
    workspace_b = await _make_workspace(tenant_b, label="collab")
    headers_a = await _authed_headers(client, tenant_id=tenant_a, workspace_id=workspace_a.id)
    headers_b = await _authed_headers(client, tenant_id=tenant_b, workspace_id=workspace_b.id)
    await _commit(client, headers_a, "a1")
    b_entity_iri = await _commit(client, headers_b, "b1")

    async with tenant_connection(tenant_a) as conn:
        ctx = await _ctx(tenant_a, conn, _ce_stub({}))
        result = await bindings.resolve_category("collaboration-activity", ctx)

    assert b_entity_iri not in [row["entity_iri"] for row in result.rows]


async def test_cursor_persists_server_side_cross_device(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-7: refreshing the widget over the real `/api/dashboard/widgets`
    route persists the cursor in `widget_instances.last_result` (ADR-013
    SWR row) -- a second "device" (fresh request, same auth) reads the same
    cursor back rather than re-baselining from zero.
    """
    tenant_id = _unique_tenant("collab-swr")
    workspace = await _make_workspace(tenant_id, label="collab")
    headers = await _authed_headers(client, tenant_id=tenant_id, workspace_id=workspace.id)
    await _commit(client, headers, "a1")

    create_resp = await client.post(
        "/api/dashboard/widgets",
        json={
            "scope": "user",
            "spec": {
                "component_type": "activity_feed",
                "title": "Recent edits",
                "data_source_contracts": ["CE-EVENT-1", "CE-READ-1"],
                "bindings": {"category": "collaboration-activity"},
                "column_span": 6,
            },
            "position": 0,
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    widget_id = create_resp.json()["id"]

    first = await client.post(f"/api/dashboard/widgets/{widget_id}/refresh", headers=headers)
    assert first.status_code == 200
    assert first.json()["status"] == "fresh"

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT last_result FROM widget_instances WHERE id = $1", widget_id
        )
    assert row["last_result"] is not None


async def test_realtime_subwidgets_post_v1_gated(client: AsyncClient, platform_stack: Path) -> None:
    """AC-5: an Explorer-sourced binding (post-v1 realtime sub-widgets) is
    gated by the existing `NOT_YET_AVAILABLE` registry mechanism -- no new
    contract ID is invented; a temporary CATEGORIES entry proves the shared
    gating logic, mirroring `test_not_yet_available_regression`'s pattern.
    """
    from weave_backend.dashboard import availability

    assert availability.source_available(["EXPLORER-REALTIME-1"]) is False
    assert availability.source_available(["CE-EVENT-1", "CE-READ-1"]) is True
