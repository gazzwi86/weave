"""CE-TASK-003 integration tests: `GET /api/sparql` and
`GET /api/ontology/resource/{iri}` against real Postgres + Oxigraph --
version resolution, pagination, and the cross-tenant isolation proof PR #28's
`run_query_unscoped` finding demanded (AC-003-08 / XT-003).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from rdflib import Graph

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

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


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _add_member(
    tenant_id: str, workspace_id: str, *, user_sub: str, role: str, email: str
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, email=email, role=role
        )
        await activate_member(conn, workspace_id=workspace_id, email=email, user_sub=user_sub)


async def _authed_client(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return headers


async def _setup_member(
    client: AsyncClient, *, label: str, role: str = "admin"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="sparql")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-1", role=role, email="u-1@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


def _valid_operations() -> list[dict[str, object]]:
    return [
        {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"},
        {"op": "add_edge", "subject_ref": "p1", "predicate": "performedBy", "object_ref": "a1"},
    ]


async def _commit_version(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )
    assert response.status_code == 201
    version_iri: str = response.json()["version_iri"]
    return version_iri


async def _any_resource_iri(version_iri: str) -> str:
    turtle = await fetch_graph_turtle(version_iri)
    graph = Graph()
    graph.parse(data=turtle, format="turtle")
    return next(str(s) for s in graph.subjects() if str(s).startswith("https://weave.io/instances/"))


async def test_sparql_get_returns_bindings_for_a_valid_select(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-04: a real SELECT against a real committed version returns
    bindings, scoped to that version's own graph via the protocol-layer
    named-graph-uri pinning (never query-text rewriting).
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="sparql-select")
    try:
        version_iri = await _commit_version(client, headers)

        response = await client.get(
            "/api/sparql",
            params={
                "query": "SELECT ?s WHERE { GRAPH ?g { ?s a ?o } }",
                "version": version_iri,
            },
            headers=headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["version_iri"] == version_iri
        assert len(body["results"]["bindings"]) >= 2  # a1 + p1 both typed
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_sparql_get_404s_on_a_nonexistent_version(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-09: a well-formed but never-committed version_iri 404s."""
    _tenant_id, workspace, headers = await _setup_member(client, label="sparql-404")
    try:
        response = await client.get(
            "/api/sparql",
            params={
                "query": "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }",
                "version": "urn:weave:tenant:bogus:ws:bogus:v9.9.9",
            },
            headers=headers,
        )
        assert response.status_code == 404
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_sparql_get_across_tenants_returns_404_for_foreign_version(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-08 / XT-003: tenant B supplying tenant A's real version_iri
    must 404, not leak results -- `versioning.get_version` is tenant-scoped
    at the SQL layer, so the version simply never resolves for B, and the
    query never reaches Oxigraph at all. This closes the same class of
    cross-tenant leak PR #28's `run_query_unscoped` finding flagged.
    """
    _tenant_a, workspace_a, headers_a = await _setup_member(client, label="sparql-tenant-a")
    _tenant_b, workspace_b, headers_b = await _setup_member(client, label="sparql-tenant-b")

    try:
        tenant_a_version_iri = await _commit_version(client, headers_a)

        response = await client.get(
            "/api/sparql",
            params={
                "query": "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }",
                "version": tenant_a_version_iri,
            },
            headers=headers_b,
        )
        assert response.status_code == 404
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)


async def test_resource_route_across_tenants_returns_404_for_a_real_iri(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-08 / XT-003: a resource IRI that is real in tenant A's graph,
    looked up by tenant B using tenant A's own real version_iri, must 404 --
    the version resolution denies B before `lookup_resource` ever runs.
    """
    _tenant_a, workspace_a, headers_a = await _setup_member(client, label="resource-tenant-a")
    _tenant_b, workspace_b, headers_b = await _setup_member(client, label="resource-tenant-b")

    try:
        tenant_a_version_iri = await _commit_version(client, headers_a)
        resource_iri = await _any_resource_iri(tenant_a_version_iri)

        response = await client.get(
            f"/api/ontology/resource/{resource_iri}",
            params={"version": tenant_a_version_iri},
            headers=headers_b,
        )
        assert response.status_code == 404
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)
