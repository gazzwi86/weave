"""PLAT-TASK-005 AC-3 integration: `GET /api/search` is tenant-scoped -- a
member of workspace A never sees workspace B's entities, mirroring
`test_tenancy_isolation.py`'s cross-tenant Oxigraph proof but through the
actual HTTP route (authz + query building + dataset scoping together).

Marked both `integration` and `docker` per that module's precedent: CI's
default `api` job runs with no compose services up.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, load_graph
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_LABEL_PREDICATE = "<http://www.w3.org/2000/01/rdf-schema#label>"


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


async def test_global_search_returns_tenant_scoped_results(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_a = _unique_tenant("search-a")
    tenant_b = _unique_tenant("search-b")
    user_a = "u-search-a"

    async with tenant_connection(tenant_a) as conn:
        workspace_a = await create_workspace(conn, tenant_id=tenant_a, slug="ws", display_name="A")
        await invite_member(
            conn,
            tenant_id=tenant_a,
            workspace_id=workspace_a.id,
            email="a@example.invalid",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace_a.id, email="a@example.invalid", user_sub=user_a
        )
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(conn, tenant_id=tenant_b, slug="ws", display_name="B")

    try:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)
        await load_graph(
            workspace_a.named_graph_iri,
            f'<urn:weave:entity:acme> {_LABEL_PREDICATE} "Acme Corp" .',
        )
        await load_graph(
            workspace_b.named_graph_iri,
            f'<urn:weave:entity:beta> {_LABEL_PREDICATE} "Acme Beta" .',
        )

        tokens = await issue_token_pair(sub=user_a, tenant_id=tenant_a)
        response = await client.get(
            "/api/search",
            params={"q": "acme", "workspace_id": workspace_a.id},
            headers={"Authorization": f"Bearer {tokens.access_token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["results"] == [
            {"iri": "urn:weave:entity:acme", "label": "Acme Corp", "kind": ""}
        ]
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)


async def test_search_below_min_length_returns_empty_without_querying_oxigraph(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("search-short")
    user_sub = "u-search-short"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Short"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="s@example.invalid",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="s@example.invalid", user_sub=user_sub
        )

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    response = await client.get(
        "/api/search",
        params={"q": "a", "workspace_id": workspace.id},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"results": [], "total": 0}


async def test_search_rejects_non_member_of_workspace(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Ledger item 3: `workspace_id` must be checked the same way
    settings/sparql now are -- an authenticated tenant principal with zero
    membership row in the workspace must not be able to search its graph.
    """
    tenant_id = _unique_tenant("search-nonmember")
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Guarded"
        )

    tokens = await issue_token_pair(sub="u-outsider", tenant_id=tenant_id)
    response = await client.get(
        "/api/search",
        params={"q": "acme", "workspace_id": workspace.id},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 403


async def test_search_rejects_foreign_tenant_workspace_id(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #11 finding (2, IDOR) class: a foreign tenant's real workspace_id
    must 404, not leak existence via a 403.
    """
    tenant_a = _unique_tenant("search-idor-a")
    tenant_b = _unique_tenant("search-idor-b")
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(conn, tenant_id=tenant_b, slug="ws", display_name="B")

    tokens = await issue_token_pair(sub="u-attacker", tenant_id=tenant_a)
    response = await client.get(
        "/api/search",
        params={"q": "acme", "workspace_id": workspace_b.id},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 404


async def test_search_emits_audit_event(client: AsyncClient, platform_stack: Path) -> None:
    """Design decision: search calls are logged to PLAT-AUDIT-1, attributable
    per PLAT-IDENTITY-1 -- mirrors the settings-write audit test.
    """
    tenant_id = _unique_tenant("search-audit")
    user_sub = "u-search-audit"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Audit"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="au@example.invalid",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="au@example.invalid", user_sub=user_sub
        )

    try:
        await clear_graph(workspace.named_graph_iri)
        tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
        response = await client.get(
            "/api/search",
            params={"q": "acme", "workspace_id": workspace.id},
            headers={"Authorization": f"Bearer {tokens.access_token}"},
        )
        assert response.status_code == 200

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT event_type, subject_iri FROM audit_events WHERE tenant_id = $1", tenant_id
            )
        assert len(rows) == 1
        assert rows[0]["event_type"] == "search.performed"
        assert rows[0]["subject_iri"] == workspace.named_graph_iri
    finally:
        await clear_graph(workspace.named_graph_iri)
