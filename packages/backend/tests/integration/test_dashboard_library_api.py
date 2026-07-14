"""PLAT-V1-TASK-015 integration tests: publish widgets to the tenant
(company) widget library, independent per-user copies (AC-1..AC-6) against
the real docker Postgres stack.

Marked both `integration` and `docker` per `test_dashboard_widgets_api.py`'s
precedent: CI's default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.dashboard import store
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


async def _pin_a_widget(tenant_id: str, owner_iri: str) -> str:
    """Mock OIDC issues no `roles` claim (no test infra sets it), so a
    caller with genuine `author` authority needs `get_current_principal`
    overridden -- see `test_project_role_guard.py`'s established pattern.
    Seeds one starter and pins it (clears `suggested`) so it's a real
    publishable `scope='user'` widget.
    """
    async with tenant_connection(tenant_id) as conn:
        await store.ensure_user_starters(
            conn, tenant_id=tenant_id, owner_principal_iri=owner_iri, role="read"
        )
        rows = await store.list_widgets(
            conn, tenant_id=tenant_id, scope="user", owner_principal_iri=owner_iri
        )
        widget_id = rows[0].id
        await store.pin_widget(conn, tenant_id=tenant_id, widget_id=widget_id)
    return widget_id


async def test_publish_stores_tenant_scoped(client: AsyncClient) -> None:
    """AC-1: publishing a pinned widget stores it tenant-scoped in
    `widget_library_items` and it's listable with author + publish date."""
    tenant_id = _unique_tenant("dash-lib-pub")
    owner_iri = human_principal_iri("u-author")
    widget_id = await _pin_a_widget(tenant_id, owner_iri)

    author_principal = Principal(
        sub="u-author",
        tenant_id=tenant_id,
        principal_iri=owner_iri,
        roles=[RoleGrant(scope="tenant", role="author")],
    )
    app.dependency_overrides[get_current_principal] = lambda: author_principal
    try:
        resp = await client.post(
            "/api/dashboard/library",
            json={"widget_id": widget_id, "name": "Entities by kind", "description": "d"},
        )
    finally:
        del app.dependency_overrides[get_current_principal]

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Entities by kind"
    assert body["author_principal_iri"] == owner_iri
    assert body["published_at"]

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT tenant_id FROM widget_library_items WHERE id = $1", body["id"]
        )
        assert row is not None
        assert row["tenant_id"] == tenant_id


async def test_publish_without_author_403_audited(client: AsyncClient) -> None:
    """AC-2: a caller with no tenant-scope `author`+ grant is rejected with
    403 and the denial is audited."""
    tenant_id = _unique_tenant("dash-lib-403")
    owner_iri = human_principal_iri("u-noauth")
    widget_id = await _pin_a_widget(tenant_id, owner_iri)

    read_only_principal = Principal(
        sub="u-noauth", tenant_id=tenant_id, principal_iri=owner_iri, roles=[]
    )
    app.dependency_overrides[get_current_principal] = lambda: read_only_principal
    try:
        resp = await client.post(
            "/api/dashboard/library",
            json={"widget_id": widget_id, "name": "x", "description": None},
        )
    finally:
        del app.dependency_overrides[get_current_principal]

    assert resp.status_code == 403

    async with tenant_connection(tenant_id) as conn:
        audit_row = await conn.fetchrow(
            "SELECT event_type FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'authz_denied'",
            tenant_id,
        )
        assert audit_row is not None


async def test_add_creates_independent_copy(client: AsyncClient) -> None:
    """AC-3: adding a library item creates an independent (tenant, user)
    copy -- refining/unpinning it never touches the library item."""
    tenant_id = _unique_tenant("dash-lib-add")
    author_iri = human_principal_iri("u-lib-author")
    widget_id = await _pin_a_widget(tenant_id, author_iri)

    author_principal = Principal(
        sub="u-lib-author",
        tenant_id=tenant_id,
        principal_iri=author_iri,
        roles=[RoleGrant(scope="tenant", role="author")],
    )
    app.dependency_overrides[get_current_principal] = lambda: author_principal
    try:
        publish_resp = await client.post(
            "/api/dashboard/library",
            json={"widget_id": widget_id, "name": "Shared view", "description": None},
        )
    finally:
        del app.dependency_overrides[get_current_principal]
    item_id = publish_resp.json()["id"]

    adder_tokens = await issue_token_pair(sub="u-adder", tenant_id=tenant_id)
    add_resp = await client.post(
        f"/api/dashboard/library/{item_id}/add",
        headers={"Authorization": f"Bearer {adder_tokens.access_token}"},
    )
    assert add_resp.status_code == 201
    copy_id = add_resp.json()["id"]
    assert copy_id != widget_id

    async with tenant_connection(tenant_id) as conn:
        copy_row = await conn.fetchrow(
            "SELECT owner_principal_iri, library_item_id FROM widget_instances WHERE id = $1",
            copy_id,
        )
        assert str(copy_row["library_item_id"]) == item_id
        assert copy_row["owner_principal_iri"] == human_principal_iri("u-adder")


async def test_library_visibility_by_authority(client: AsyncClient) -> None:
    """AC-4: listing the library needs only tenant membership (read
    authority), not `author` -- returns name/description/author/date/spec
    preview fields."""
    tenant_id = _unique_tenant("dash-lib-view")
    author_iri = human_principal_iri("u-lib-view-author")
    widget_id = await _pin_a_widget(tenant_id, author_iri)

    author_principal = Principal(
        sub="u-lib-view-author",
        tenant_id=tenant_id,
        principal_iri=author_iri,
        roles=[RoleGrant(scope="tenant", role="author")],
    )
    app.dependency_overrides[get_current_principal] = lambda: author_principal
    try:
        await client.post(
            "/api/dashboard/library",
            json={"widget_id": widget_id, "name": "Viewable item", "description": "d"},
        )
    finally:
        del app.dependency_overrides[get_current_principal]

    reader_tokens = await issue_token_pair(sub="u-reader", tenant_id=tenant_id)
    resp = await client.get(
        "/api/dashboard/library",
        headers={"Authorization": f"Bearer {reader_tokens.access_token}"},
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(item["name"] == "Viewable item" for item in items)
    item = next(item for item in items if item["name"] == "Viewable item")
    assert item["author_principal_iri"] == author_iri
    assert "component_type" in item
    assert "data_source_contracts" in item


async def test_library_actions_audited(client: AsyncClient) -> None:
    """AC-5: both publish and add write `PLAT-AUDIT-1` entries in the same
    transaction as the state change."""
    tenant_id = _unique_tenant("dash-lib-audit")
    author_iri = human_principal_iri("u-audit-author")
    widget_id = await _pin_a_widget(tenant_id, author_iri)

    author_principal = Principal(
        sub="u-audit-author",
        tenant_id=tenant_id,
        principal_iri=author_iri,
        roles=[RoleGrant(scope="tenant", role="author")],
    )
    app.dependency_overrides[get_current_principal] = lambda: author_principal
    try:
        publish_resp = await client.post(
            "/api/dashboard/library",
            json={"widget_id": widget_id, "name": "Audited item", "description": None},
        )
    finally:
        del app.dependency_overrides[get_current_principal]
    item_id = publish_resp.json()["id"]

    adder_tokens = await issue_token_pair(sub="u-audit-adder", tenant_id=tenant_id)
    await client.post(
        f"/api/dashboard/library/{item_id}/add",
        headers={"Authorization": f"Bearer {adder_tokens.access_token}"},
    )

    async with tenant_connection(tenant_id) as conn:
        published = await conn.fetchrow(
            "SELECT 1 FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'dashboard.library.published'",
            tenant_id,
        )
        added = await conn.fetchrow(
            "SELECT 1 FROM audit_entries"
            " WHERE tenant_id = $1 AND event_type = 'dashboard.library.added'",
            tenant_id,
        )
        assert published is not None
        assert added is not None
