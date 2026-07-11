"""TASK-025 integration tests: `/api/views*` + `/api/comments*` against real
Aurora (docker postgres), proving AC-1 (migration DDL/RLS), AC-2 (atomic
save+snapshot), AC-4 (delete authorisation), AC-7 (pin limit), AC-8
(cross-tenant isolation), and AC-9 (10k-row snapshot perf). Mirrors
test_layout_persistence.py's fixture/marker style; admin-role tests use the
`get_current_principal` override pattern from test_project_role_guard.py
since mock-OIDC mints no `roles` claim.
"""

from __future__ import annotations

import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection, untenanted_connection
from weave_backend.explorer.persistence import explorer_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.notifications.store import NotificationQuery, list_notifications
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _tenant_slug(prefix: str) -> str:
    """Each test gets its own tenant slug -- see test_layout_persistence.py's
    identical rationale (migration 0014 regression: real tenant ids are
    free-text slugs, never UUIDs).
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _admin_principal(*, tenant_id: str, sub: str) -> Principal:
    return Principal(
        sub=sub,
        tenant_id=tenant_id,
        principal_iri=f"urn:weave:principal:user:{sub}",
        roles=[RoleGrant(scope="tenant", role="admin")],
    )


async def _seed_workspace_member(*, tenant_id: str, sub: str) -> None:
    """AC-5: `has_graph_access` treats an active workspace membership as
    graph access -- mirrors test_layout_persistence.py's `_member_workspace`.
    """
    email = f"{sub}@example.invalid"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Views"
        )
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=email, role="read"
        )
        await activate_member(conn, workspace_id=workspace.id, email=email, user_sub=sub)


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


async def _auth_headers(*, tenant_id: str, sub: str) -> dict[str, str]:
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def test_migration_creates_tables_with_rls_and_unique_constraint(
    platform_stack: Path,
) -> None:
    """AC-1: both tables carry ENABLE+FORCE RLS, a `tenant_isolation` policy,
    and `explorer_saved_views` carries the `UNIQUE (tenant_id, name)` DB
    constraint the app relies on for its 409 collision check.
    """
    async with untenanted_connection() as conn:
        for table in ("explorer_saved_views", "explorer_comments"):
            row = await conn.fetchrow(
                "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
                table,
            )
            assert row is not None, f"{table} does not exist"
            assert row["relrowsecurity"] is True
            assert row["relforcerowsecurity"] is True

            policy = await conn.fetchrow(
                "SELECT polname FROM pg_policy pol"
                " JOIN pg_class cls ON pol.polrelid = cls.oid"
                " WHERE cls.relname = $1 AND pol.polname = 'tenant_isolation'",
                table,
            )
            assert policy is not None, f"{table} has no tenant_isolation policy"

        unique = await conn.fetchrow(
            "SELECT conname FROM pg_constraint con"
            " JOIN pg_class cls ON con.conrelid = cls.oid"
            " WHERE cls.relname = 'explorer_saved_views' AND con.contype = 'u'"
        )
        assert unique is not None, "explorer_saved_views is missing its UNIQUE constraint"


async def test_view_save_snapshots_layout_atomically_and_rolls_back_on_failure(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-2 (happy path + rollback). Happy path: saving a view snapshots
    node positions into `explorer_layout_positions` under `view:{id}` in the
    same transaction. Rollback: a duplicate `node_iri` within one save's
    position batch trips the layout table's primary key mid-transaction --
    proving the view row inserted moments earlier in the *same* transaction
    is rolled back too (asyncpg's `conn.transaction()`, not two independent
    writes).
    """
    tenant_id = _tenant_slug("acme-corp")
    headers = await _auth_headers(tenant_id=tenant_id, sub="u-save")

    ok_response = await client.post(
        "/api/views",
        json={
            "name": "Q3 Ops Review",
            "definition": {"filters": {"kind": "process"}},
            "positions": [
                {"node_iri": "urn:weave:entity:a", "position_x": 1.0, "position_y": 2.0},
                {"node_iri": "urn:weave:entity:b", "position_x": 3.0, "position_y": 4.0},
            ],
        },
        headers=headers,
    )
    assert ok_response.status_code == 201
    view_id = ok_response.json()["view_id"]

    async with explorer_connection(tenant_id) as conn:
        snapshot_rows = await conn.fetch(
            "SELECT node_iri, locked FROM explorer_layout_positions"
            " WHERE tenant_id = $1 AND graph_id = $2",
            tenant_id,
            f"view:{view_id}",
        )
    assert len(snapshot_rows) == 2
    assert all(row["locked"] is True for row in snapshot_rows)

    failing_response = await client.post(
        "/api/views",
        json={
            "name": "Broken Save",
            "definition": {"filters": {}},
            "positions": [
                {"node_iri": "urn:weave:entity:dup", "position_x": 1.0, "position_y": 1.0},
                {"node_iri": "urn:weave:entity:dup", "position_x": 2.0, "position_y": 2.0},
            ],
        },
        headers=headers,
    )
    assert failing_response.status_code == 503

    async with explorer_connection(tenant_id) as conn:
        broken_view = await conn.fetchrow(
            "SELECT view_id FROM explorer_saved_views WHERE tenant_id = $1 AND name = $2",
            tenant_id,
            "Broken Save",
        )
    assert broken_view is None, "view row must roll back when the snapshot insert fails"


async def test_name_collision_409_and_overwrite(client: AsyncClient, platform_stack: Path) -> None:
    """AC-3: a second save with the same name 409s with the existing view
    id; passing `overwrite: true` idempotently replaces the definition and
    snapshot instead.
    """
    tenant_id = _tenant_slug("acme-corp")
    headers = await _auth_headers(tenant_id=tenant_id, sub="u-collide")
    first = await client.post(
        "/api/views",
        json={"name": "dup", "definition": {"a": 1}, "positions": []},
        headers=headers,
    )
    view_id = first.json()["view_id"]

    collision = await client.post(
        "/api/views",
        json={"name": "dup", "definition": {"a": 2}, "positions": []},
        headers=headers,
    )
    assert collision.status_code == 409
    assert collision.json()["detail"]["existing_view_id"] == view_id

    overwrite = await client.post(
        "/api/views",
        json={"name": "dup", "definition": {"a": 2}, "positions": [], "overwrite": True},
        headers=headers,
    )
    assert overwrite.status_code == 201
    assert overwrite.json()["view_id"] == view_id


async def test_delete_creator_own_admin_any_else_403(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-4: the creator can delete their own view; any other non-admin
    caller is refused with 403; a tenant admin can delete anyone's view.
    """
    tenant_id = _tenant_slug("acme-corp")
    owner_headers = await _auth_headers(tenant_id=tenant_id, sub="u-owner")
    outsider_headers = await _auth_headers(tenant_id=tenant_id, sub="u-outsider")

    save = await client.post(
        "/api/views",
        json={"name": "owner-view", "definition": {}, "positions": []},
        headers=owner_headers,
    )
    view_id = save.json()["view_id"]

    forbidden = await client.delete(f"/api/views/{view_id}", headers=outsider_headers)
    assert forbidden.status_code == 403

    admin_only = await client.post(
        "/api/views",
        json={"name": "admin-target", "definition": {}, "positions": []},
        headers=owner_headers,
    )
    admin_view_id = admin_only.json()["view_id"]
    app.dependency_overrides[get_current_principal] = lambda: _admin_principal(
        tenant_id=tenant_id, sub="u-admin"
    )
    try:
        admin_delete = await client.delete(f"/api/views/{admin_view_id}", headers=owner_headers)
    finally:
        del app.dependency_overrides[get_current_principal]
    assert admin_delete.status_code == 204

    own_delete = await client.delete(f"/api/views/{view_id}", headers=owner_headers)
    assert own_delete.status_code == 204


async def test_view_delete_removes_snapshot_rows(client: AsyncClient, platform_stack: Path) -> None:
    """AC-4: deleting a view deletes its `view:*` layout snapshot rows in
    the same transaction.
    """
    tenant_id = _tenant_slug("acme-corp")
    headers = await _auth_headers(tenant_id=tenant_id, sub="u-owner2")
    save = await client.post(
        "/api/views",
        json={
            "name": "with-snapshot",
            "definition": {},
            "positions": [{"node_iri": "urn:weave:entity:x", "position_x": 1.0, "position_y": 1.0}],
        },
        headers=headers,
    )
    view_id = save.json()["view_id"]

    delete_response = await client.delete(f"/api/views/{view_id}", headers=headers)
    assert delete_response.status_code == 204

    async with explorer_connection(tenant_id) as conn:
        remaining = await conn.fetch(
            "SELECT 1 FROM explorer_layout_positions WHERE tenant_id = $1 AND graph_id = $2",
            tenant_id,
            f"view:{view_id}",
        )
    assert remaining == []


async def test_pin_limit_409_admin_only(client: AsyncClient, platform_stack: Path) -> None:
    """AC-7: only a tenant admin may pin; pinning beyond the limit (5) 409s."""
    tenant_id = _tenant_slug("acme-corp")
    owner_headers = await _auth_headers(tenant_id=tenant_id, sub="u-pinowner")
    view_ids = []
    for i in range(6):
        save = await client.post(
            "/api/views",
            json={"name": f"pin-{i}", "definition": {}, "positions": []},
            headers=owner_headers,
        )
        view_ids.append(save.json()["view_id"])

    # Non-admin check runs with no dependency override -- the override below
    # replaces `get_current_principal` outright, so it must not be active
    # while proving a real (non-overridden) JWT is refused.
    not_admin_check = await client.patch(
        f"/api/views/{view_ids[0]}/pin", json={"pinned": True}, headers=owner_headers
    )
    assert not_admin_check.status_code == 403

    app.dependency_overrides[get_current_principal] = lambda: _admin_principal(
        tenant_id=tenant_id, sub="u-pinadmin"
    )
    try:
        for view_id in view_ids[:5]:
            pin_response = await client.patch(
                f"/api/views/{view_id}/pin", json={"pinned": True}, headers=owner_headers
            )
            assert pin_response.status_code == 200

        over_limit = await client.patch(
            f"/api/views/{view_ids[5]}/pin", json={"pinned": True}, headers=owner_headers
        )
        assert over_limit.status_code == 409
    finally:
        del app.dependency_overrides[get_current_principal]


async def test_cross_tenant_views_comments_isolation(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-8: a tenant-A caller sees zero tenant-B rows across views,
    comments, and `view:*` layout rows; addressing a tenant-B view id 404s.
    """
    tenant_a, tenant_b = _tenant_slug("acme-corp"), _tenant_slug("globex")
    headers_a = await _auth_headers(tenant_id=tenant_a, sub="u-iso-a")
    headers_b = await _auth_headers(tenant_id=tenant_b, sub="u-iso-b")

    save_b = await client.post(
        "/api/views",
        json={
            "name": "b-view",
            "definition": {},
            "positions": [{"node_iri": "urn:weave:entity:b", "position_x": 1.0, "position_y": 1.0}],
        },
        headers=headers_b,
    )
    view_b_id = save_b.json()["view_id"]
    await client.post(
        "/api/comments",
        json={"target_kind": "node", "target_ref": "urn:weave:entity:b", "body": "b comment"},
        headers=headers_b,
    )

    list_as_a = await client.get("/api/views", headers=headers_a)
    assert list_as_a.json() == []

    comments_as_a = await client.get(
        "/api/comments",
        params={"target_kind": "node", "target_ref": "urn:weave:entity:b"},
        headers=headers_a,
    )
    assert comments_as_a.json() == []

    delete_as_a = await client.delete(f"/api/views/{view_b_id}", headers=headers_a)
    assert delete_as_a.status_code == 404

    async with explorer_connection(tenant_a) as conn:
        leaked_snapshot = await conn.fetch(
            "SELECT 1 FROM explorer_layout_positions WHERE graph_id = $1", f"view:{view_b_id}"
        )
    assert leaked_snapshot == []


async def test_view_save_p95_under_800ms_10k(client: AsyncClient, platform_stack: Path) -> None:
    """AC-9 (measure-first): a 10k-node snapshot save completes within
    800 ms. Single-run wall-clock measurement -- see ADR-025 for the
    recorded result and the chunked multi-VALUES batching this proves out.
    """
    tenant_id = _tenant_slug("acme-corp")
    headers = await _auth_headers(tenant_id=tenant_id, sub="u-perf")
    positions = [
        {"node_iri": f"urn:weave:entity:{i}", "position_x": float(i), "position_y": float(i)}
        for i in range(10_000)
    ]

    start = time.perf_counter()
    response = await client.post(
        "/api/views",
        json={"name": "perf-10k", "definition": {}, "positions": positions},
        headers=headers,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 201
    assert elapsed_ms < 800, f"10k-node save took {elapsed_ms:.1f}ms, over the 800ms AC-9 budget"


async def test_share_view_publishes_and_excludes_ineligible_recipient(
    client: AsyncClient, platform_stack: Path
) -> None:
    """E2E slot (AC-5): no share UI exists yet (TASK-026 owns it) -- ships
    as a service-level test through the real HTTP API + real Postgres,
    proving the PLAT-NOTIFY-1 stub actually receives the event for the
    eligible recipient and excludes the ineligible one. Mirrors
    test_workspace_switch_e2e.py's identical "no UI yet" deviation.
    """
    tenant_id = _tenant_slug("acme-corp")
    owner_headers = await _auth_headers(tenant_id=tenant_id, sub="u-sharer")
    eligible_iri = "urn:weave:principal:user:u-eligible"
    ineligible_iri = "urn:weave:principal:user:u-ineligible"
    await issue_token_pair(sub="u-eligible", tenant_id=tenant_id)
    await _seed_workspace_member(tenant_id=tenant_id, sub="u-eligible")

    save = await client.post(
        "/api/views",
        json={"name": "shared-view", "definition": {}, "positions": []},
        headers=owner_headers,
    )
    view_id = save.json()["view_id"]

    share_response = await client.post(
        f"/api/views/{view_id}/share",
        json={"recipients": [eligible_iri, ineligible_iri]},
        headers=owner_headers,
    )
    assert share_response.status_code == 202
    assert share_response.json() == {"notified": 1, "excluded": 1}

    async with tenant_connection(tenant_id) as conn:
        eligible_notifications, _ = await list_notifications(
            conn, NotificationQuery(tenant_id=tenant_id, recipient_iri=eligible_iri)
        )
        ineligible_notifications, _ = await list_notifications(
            conn, NotificationQuery(tenant_id=tenant_id, recipient_iri=ineligible_iri)
        )
    assert len(eligible_notifications) == 1
    assert eligible_notifications[0].event_type == "explorer.view-shared"
    assert ineligible_notifications == []
