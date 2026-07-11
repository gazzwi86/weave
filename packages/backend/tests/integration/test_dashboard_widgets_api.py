"""PLAT-V1-TASK-010 integration tests: widget-state foundation + fixed
CE-sourced default dashboard (AC-1, AC-2, AC-4, AC-6, AC-7, AC-8, AC-9)
against the real docker Postgres stack.

Marked both `integration` and `docker` per `test_notifications_api.py`'s
precedent: CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient, MockTransport, Request, Response

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.dashboard import store
from weave_backend.dashboard.ce_metrics import get_ce_metrics_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


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
    """AC-4/AC-7: a fake CE-METRICS-1 client, wired in via the same
    ``app.dependency_overrides`` seam every other httpx-client dependency
    in this codebase uses for tests (deploy.py/briefs.py precedent).
    """

    async def _handler(request: Request) -> Response:
        return Response(status_code=status_code, json=body)

    return AsyncClient(transport=MockTransport(_handler), base_url="http://ce-metrics")


async def test_default_tiles_seeded_on_tenant_create(client: AsyncClient) -> None:
    """AC-2: creating a tenant's first workspace seeds the 6-tile fixed
    default dashboard (`create_workspace_route` is this codebase's
    tenant-provisioning hook -- no separate route composes/reorders it).
    """
    tenant_id = _unique_tenant("dash-seed")
    tokens = await issue_token_pair(sub="u-seed", tenant_id=tenant_id)

    create_resp = await client.post(
        f"/api/tenants/{tenant_id}/workspaces",
        json={"slug": "primary", "display_name": "Primary"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert create_resp.status_code == 201

    list_resp = await client.get(
        "/api/dashboard/widgets",
        params={"scope": "tenant_default"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert len(body["widgets"]) == 6
    assert [w["position"] for w in body["widgets"]] == [0, 1, 2, 3, 4, 5]
    assert all(w["spec"]["data_source_contracts"] == ["CE-METRICS-1"] for w in body["widgets"])


async def test_backfill_seeds_existing_tenants(client: AsyncClient) -> None:
    """AC-2: a tenant whose workspace predates migration 0071 (no seed call
    ever ran) still ends up with the fixed default tiles once
    ``seed_tenant_default_tiles`` is applied directly -- exercises the same
    idempotent insert the 0072 backfill migration performs at the SQL level.
    """
    tenant_id = _unique_tenant("dash-backfill")
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        # Idempotency: a second call (e.g. a 2nd workspace) must not duplicate rows.
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="tenant_default", owner_principal_iri=None
        )
    assert len(rows) == 6


async def test_widget_read_returns_swr_payload(client: AsyncClient) -> None:
    """AC-6: `GET /api/dashboard/widgets` is a pure read of whatever is
    already stored -- no upstream CE call happens on this path.
    """
    tenant_id = _unique_tenant("dash-swr")
    tokens = await issue_token_pair(sub="u-swr", tenant_id=tenant_id)
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)

    resp = await client.get(
        "/api/dashboard/widgets",
        params={"scope": "tenant_default"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    widgets = resp.json()["widgets"]
    assert len(widgets) == 6
    assert all(w["status"] == "unavailable" for w in widgets)
    assert all(w["last_result"] is None for w in widgets)


async def test_refresh_failure_sets_stale_retains_payload(client: AsyncClient) -> None:
    """AC-7: a widget with a prior successful payload that then fails to
    refresh renders `stale`, keeping the old `last_result` -- never blanked.
    """
    tenant_id = _unique_tenant("dash-stale")
    tokens = await issue_token_pair(sub="u-stale", tenant_id=tenant_id)
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="tenant_default", owner_principal_iri=None
        )
    widget_id = rows[0].id  # "Entities in model", field=entity_count_by_kind, aggregate=sum

    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )
    ok_resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/refresh",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["status"] == "fresh"

    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {}, status_code=503
    )
    fail_resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/refresh",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert fail_resp.status_code == 200
    assert fail_resp.json()["status"] == "stale"

    async with tenant_connection(tenant_id) as conn:
        row = await store.get_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
    assert row is not None
    # aggregate=sum collapses the per-kind dict to a single int (ce_metrics.fetch).
    assert row.last_result == 4


async def test_stale_bound_renders_on_read_without_failed_refresh(client: AsyncClient) -> None:
    """QA edge case (AC-7 clause 2): "a payload older than 2x refresh_interval_s
    SHALL render the stale badge even without a failed refresh" is a *read-path*
    requirement, not just a `derive_status` unit-test fact. A widget written
    `fresh` that then ages past the 2x bound must come back `stale` from
    `GET /api/dashboard/widgets` on its own -- nothing ever calls CE again.
    """
    tenant_id = _unique_tenant("dash-stale-read")
    tokens = await issue_token_pair(sub="u-stale-read", tenant_id=tenant_id)
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="tenant_default", owner_principal_iri=None
        )
        widget_id = rows[0].id
        # Simulate a fresh write from long ago -- refresh_interval_s defaults
        # to 300s, so 20 minutes ago is well past the 2x (10 min) bound.
        await conn.execute(
            "UPDATE widget_instances SET last_result = '4'::jsonb, status = 'fresh',"
            " fetched_at = now() - interval '20 minutes' WHERE id = $1",
            widget_id,
        )

    resp = await client.get(
        "/api/dashboard/widgets",
        params={"scope": "tenant_default"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    widget = next(w for w in resp.json()["widgets"] if w["id"] == widget_id)
    assert widget["status"] == "stale"


async def test_metrics_error_renders_unavailable_state(client: AsyncClient) -> None:
    """AC-4: a widget with no prior payload that fails its first refresh
    renders `unavailable`, not a 500.
    """
    tenant_id = _unique_tenant("dash-unavail")
    tokens = await issue_token_pair(sub="u-unavail", tenant_id=tenant_id)
    async with tenant_connection(tenant_id) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_id)
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="tenant_default", owner_principal_iri=None
        )
    widget_id = rows[0].id

    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {}, status_code=503
    )
    resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/refresh",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "unavailable"


async def test_starters_role_appropriate_and_clearable(client: AsyncClient) -> None:
    """AC-8: role-appropriate starters are seeded on first user-scope load,
    `suggested=true`, and removable via DELETE.

    The mock OIDC issuer (`mock_oidc/tokens.py::issue_token_pair`) has no
    `roles`-claim parameter, so a real bearer token here always resolves to
    `principal.roles == []` -- `resolve_starter_role` is already proven
    against the full role-ranking logic in
    `test_dashboard_default_tiles.py::test_starter_role_map`. This test
    proves the store-level seed/clear behaviour directly with an explicit
    role, and proves the DELETE route's owner-only enforcement over real
    HTTP -- rather than growing the shared JWT test fixture for one task's
    role-claim need (Law 3, touch only what you must).
    """
    tenant_id = _unique_tenant("dash-starter")
    user_sub = "u-starter"
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    owner_iri = human_principal_iri(user_sub)

    async with tenant_connection(tenant_id) as conn:
        await store.ensure_user_starters(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_iri, role="publish"
        )
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
    assert [row.spec.title for row in rows] == ["SHACL errors by severity", "Entities by kind"]
    assert all(row.suggested for row in rows)

    widget_id = rows[0].id
    del_resp = await client.delete(
        f"/api/dashboard/widgets/{widget_id}",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert del_resp.status_code == 204

    async with tenant_connection(tenant_id) as conn:
        remaining = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
    assert [row.id for row in remaining] == [rows[1].id]


async def test_delete_other_users_starter_is_not_found(client: AsyncClient) -> None:
    """AC-8/IDOR: a user cannot delete another user's private widget by
    guessing its id -- 404, not 403, so existence isn't leaked either.
    """
    tenant_id = _unique_tenant("dash-idor")
    owner_iri = human_principal_iri("u-owner")
    other_tokens = await issue_token_pair(sub="u-other", tenant_id=tenant_id)

    async with tenant_connection(tenant_id) as conn:
        await store.ensure_user_starters(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_iri, role="read"
        )
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
    widget_id = rows[0].id

    resp = await client.delete(
        f"/api/dashboard/widgets/{widget_id}",
        headers={"Authorization": f"Bearer {other_tokens.access_token}"},
    )
    assert resp.status_code == 404


async def test_refresh_other_users_starter_is_not_found(client: AsyncClient) -> None:
    """QA edge case (AC-8/IDOR sibling of the delete-route fix): a tenant
    member must not be able to trigger a refresh -- and thereby mutate
    `status`/`fetched_at` and observe them -- on another user's private
    `scope='user'` widget by id-guessing. `delete_widget_route` checks
    `owner_principal_iri`; `refresh_widget_route` must apply the same
    owner-only gate, not just tenant scoping.
    """
    tenant_id = _unique_tenant("dash-refresh-idor")
    owner_iri = human_principal_iri("u-refresh-owner")
    other_tokens = await issue_token_pair(sub="u-refresh-other", tenant_id=tenant_id)

    async with tenant_connection(tenant_id) as conn:
        await store.ensure_user_starters(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_iri, role="read"
        )
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
    widget_id = rows[0].id

    app.dependency_overrides[get_ce_metrics_client] = lambda: _ce_metrics_stub(
        {"entity_count_by_kind": {"Process": 4}}
    )
    resp = await client.post(
        f"/api/dashboard/widgets/{widget_id}/refresh",
        headers={"Authorization": f"Bearer {other_tokens.access_token}"},
    )
    assert resp.status_code == 404


async def test_widget_tables_rls_enforced(client: AsyncClient) -> None:
    """AC-1: FORCE ROW LEVEL SECURITY bites even with no tenant_id WHERE
    clause at all -- DB-level backstop, not just app-layer filtering
    (precedent: test_gates_api.py::test_gate_results_rls_tenant_isolation).
    Covers all three new tables, not just `widget_instances` -- a widget's
    library-item and refinement rows are exactly as tenant-sensitive as the
    widget row itself.
    """
    tenant_a = _unique_tenant("dash-rls-a")
    tenant_b = _unique_tenant("dash-rls-b")
    async with tenant_connection(tenant_a) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_a)
        widget_row = await conn.fetchrow("SELECT id FROM widget_instances LIMIT 1")
        await conn.execute(
            "INSERT INTO widget_library_items"
            " (tenant_id, name, spec, author_principal_iri)"
            " VALUES ($1, 'Test item', '{}'::jsonb, 'urn:test:author')",
            tenant_a,
        )
        await conn.execute(
            "INSERT INTO widget_refinements"
            " (tenant_id, widget_instance_id, step, prompt, spec)"
            " VALUES ($1, $2, 0, 'test prompt', '{}'::jsonb)",
            tenant_a,
            widget_row["id"],
        )

    async with tenant_connection(tenant_b) as conn:
        assert await conn.fetch("SELECT id FROM widget_instances") == []
        assert await conn.fetch("SELECT id FROM widget_library_items") == []
        assert await conn.fetch("SELECT id FROM widget_refinements") == []


async def test_widget_state_cross_tenant_isolation(client: AsyncClient) -> None:
    """AC-9: the same check repeated through the HTTP surface -- tenant B's
    bearer token must never see tenant A's tiles, even with identical
    positions/titles.
    """
    tenant_a = _unique_tenant("dash-iso-a")
    tenant_b = _unique_tenant("dash-iso-b")
    async with tenant_connection(tenant_a) as conn:
        await store.seed_tenant_default_tiles(conn, tenant_id=tenant_a)

    tokens_b = await issue_token_pair(sub="u-iso-b", tenant_id=tenant_b)
    resp = await client.get(
        "/api/dashboard/widgets",
        params={"scope": "tenant_default"},
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["widgets"] == []


async def test_stale_bound_renders_on_read_for_user_scope_starters(client: AsyncClient) -> None:
    """QA edge case (re-QA, AC-7 clause 2): the retry-1 fix wired
    `derive_status` into `list_widgets_route` for every row it returns, but
    the only proof on file (`test_stale_bound_renders_on_read_without_...`)
    exercises `scope=tenant_default` tiles. `scope=user` starter rows go
    through the exact same `_to_widget_out` helper -- confirm the age bound
    also fires there, not just for the fixed default tiles.
    """
    tenant_id = _unique_tenant("dash-stale-read-user")
    owner_iri = human_principal_iri("u-stale-read-user")
    tokens = await issue_token_pair(sub="u-stale-read-user", tenant_id=tenant_id)

    async with tenant_connection(tenant_id) as conn:
        await store.ensure_user_starters(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_iri, role="read"
        )
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
        widget_id = rows[0].id
        # Same 20-minutes-ago simulation as the tenant_default proof --
        # default refresh_interval_s is 300s, so this is well past the 2x
        # (10 min) staleness bound.
        await conn.execute(
            "UPDATE widget_instances SET last_result = '4'::jsonb, status = 'fresh',"
            " fetched_at = now() - interval '20 minutes' WHERE id = $1",
            widget_id,
        )

    resp = await client.get(
        "/api/dashboard/widgets",
        params={"scope": "user"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert resp.status_code == 200
    widget = next(w for w in resp.json()["widgets"] if w["id"] == widget_id)
    assert widget["status"] == "stale"
