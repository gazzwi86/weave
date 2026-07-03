"""AC-7 (E2E slot): switching workspace scopes every subsequent SPARQL query
to that workspace's named graph, proven end-to-end through the real HTTP API
against a real Oxigraph.

Deviation (recorded for QA): the brief's E2E scenario is UI-driven
("workspace switcher -> query screen"), but no workspace-switcher page
exists yet -- that's PLAT-TASK-005's UI. Per the brief's own fallback, this
ships as an API-level integration test of the identical scope-rewrite path
the future UI will call, marked `e2e` (not `docker`-only) to flag it as the
task's E2E deliverable. Replace with a Playwright spec once TASK-005 lands
the workspace switcher.
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
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.e2e,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


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


async def test_workspace_switch_scopes_query(client: AsyncClient, platform_stack: Path) -> None:
    tenant_id = f"tenant-switch-{uuid.uuid4().hex[:8]}"
    user_sub = "u-switcher"

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Switch workspace"
        )

    await clear_graph(workspace.named_graph_iri)
    await load_graph(workspace.named_graph_iri, "<urn:canary:s> <urn:canary:p> <urn:canary:o> .")

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    select_query = "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }"
    try:
        # Before switching, there's no active workspace -- the query must be
        # rejected rather than silently falling back to some default graph.
        no_workspace_response = await client.post(
            "/api/sparql", json={"query": select_query}, headers=headers
        )
        assert no_workspace_response.status_code == 400
        assert no_workspace_response.json()["detail"]["error"] == "no_active_workspace"

        switch_response = await client.post(
            f"/api/workspaces/{workspace.id}/switch", headers=headers
        )
        assert switch_response.status_code == 200

        query_response = await client.post(
            "/api/sparql", json={"query": select_query}, headers=headers
        )
        assert query_response.status_code == 200
        bindings = query_response.json()["results"]["bindings"]
        assert {b["s"]["value"] for b in bindings} == {"urn:canary:s"}
    finally:
        await clear_graph(workspace.named_graph_iri)
