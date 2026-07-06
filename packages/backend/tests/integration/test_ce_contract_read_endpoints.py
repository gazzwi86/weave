"""CE-TASK-003 cross-cutting gap-fill: real-HTTP proof (over the docker
lane, `app` itself -- not an isolated toy app) for the two DoD items the
per-endpoint test files didn't yet cover:

* AC-003-07: every CE-READ-1 endpoint 401s a request with no bearer token
  at all (the write side already has this in `test_operations_apply.py`;
  the read side didn't).
* AC-003-14: `X-CE-Version` is present on a *real* response from the real
  `app` router stack, not just the isolated `CeContractHeadersMiddleware`
  unit test's toy app.
* AC-003-01 (+ its E2E slot): `GET /api/ontology/types` returns the BPMO
  kind catalogue for an authenticated caller -- no existing integration
  test hit this route over real HTTP at all.
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
from weave_backend.observability.middleware import CE_API_VERSION
from weave_backend.rdf.oxigraph_client import clear_graph
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
    client: AsyncClient, *, label: str
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="ce-contract")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-1", role="admin", email="u-1@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/ontology/types"),
        ("GET", "/api/ontology/versions"),
        ("GET", "/api/ontology/resource/urn:weave:example:whatever"),
        ("GET", "/api/sparql?query=SELECT+%3Fs+WHERE+%7B+GRAPH+%3Fg+%7B+%3Fs+%3Fp+%3Fo+%7D+%7D"),
    ],
)
async def test_read_endpoint_401s_with_no_bearer_token(
    client: AsyncClient, method: str, path: str
) -> None:
    """AC-003-07: every CE-READ-1 endpoint rejects an unauthenticated
    request the same way the write side already does.
    """
    response = await client.request(method, path)
    assert response.status_code == 401
    assert response.json() == {"error": "unauthorised"}


async def test_ontology_types_returns_bpmo_catalogue_for_an_authenticated_caller(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-01 (+ its E2E slot): a real authenticated caller -- standing in
    for the Build Engine, which does not exist as a separate process yet --
    gets the full BPMO kind catalogue back over real HTTP.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="types")
    try:
        response = await client.get("/api/ontology/types", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert len(body["kinds"]) > 0
        assert all({"iri", "label", "properties"} <= set(k) for k in body["kinds"])
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_ce_version_header_present_on_a_real_read_response(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-003-14, proved against the real `app` (not the isolated toy app
    the middleware's own unit test uses).
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ce-version")
    try:
        response = await client.get("/api/ontology/types", headers=headers)
        assert response.headers["x-ce-version"] == CE_API_VERSION
        assert response.headers["x-tenant-id"] == _tenant_id
    finally:
        await clear_graph(workspace.named_graph_iri)
