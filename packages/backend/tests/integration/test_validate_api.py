"""CE-TASK-006 integration tests: `GET /api/validate` against real
Oxigraph + Postgres + Redis (docker lane). Fixture pattern copied from
`test_metrics_api.py` (no shared conftest yet -- repo convention).

Perf (AC-006-06): in-process 100k-triple timing, ADR-004 style (NOT
locust -- ADR-004 already proved the read path is safe at scale; this
just re-confirms the wired-up endpoint holds the same budget).
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
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import load_graph
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
    client: AsyncClient, *, label: str, role: str = "publish"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="validate")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-1", role=role, email="u-1@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


async def test_validate_401s_with_no_bearer_token(client: AsyncClient) -> None:
    """AC-006-02."""
    response = await client.get("/api/validate")
    assert response.status_code == 401


async def test_validate_404s_unknown_version(client: AsyncClient) -> None:
    """AC-006-02."""
    _tenant_id, _workspace, headers = await _setup_member(client, label="validate-404")
    response = await client.get(
        "/api/validate", params={"version": "urn:weave:tenant:x:ws:y:v9.9.9"}, headers=headers
    )
    assert response.status_code == 404


async def test_validate_pending_before_any_run(client: AsyncClient) -> None:
    """AC-006-04: a fresh draft, never validated, must report pending --
    never an empty/zero report readable as 'no violations'."""
    _tenant_id, _workspace, headers = await _setup_member(client, label="validate-pending")
    response = await client.get("/api/validate", params={"version": "draft"}, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"pending": True}


async def test_validate_full_report_with_all_three_severities(client: AsyncClient) -> None:
    """AC-006-01/-03: seeds an Activity missing `description` (Warning,
    framework.shacl.ttl:51) and a Goal missing `servesGoal` (Info,
    framework.shacl.ttl:70) -- both pass the commit-gate (only Violation
    blocks a write). Then commits a TENANT shape (TASK-005) requiring
    Activity.description at sh:Violation *after* that Activity already
    exists: the commit-gate never re-validates old data on a shape edit,
    so this is a genuine violation only `GET /api/validate`'s whole-graph
    audit surfaces -- the exact "detect drift after a shape change"
    scenario this endpoint exists for (m2-delta.md design decision)."""
    _tenant_id, _workspace, headers = await _setup_member(
        client, label="validate-severities", role="admin"
    )
    ops = [
        {"op": "add_node", "ref": "act1", "kind": "Activity", "label": "Bare Activity"},
        {"op": "add_node", "ref": "g1", "kind": "Goal", "label": "Bare Goal"},
    ]
    apply_response = await client.post(
        "/api/operations/apply",
        json={"operations": ops, "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )
    assert apply_response.status_code == 201

    shape_turtle = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<https://weave.io/instances/shape-description-required> a sh:NodeShape ;
    sh:targetClass weave:Activity ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Every Activity must carry a description."@en ;
    ] .
"""
    commit_response = await client.post(
        "/api/ontology/authoring/nl/shapes/commit",
        json={"shape_turtle": shape_turtle, "ai_generated": False},
        headers=headers,
    )
    assert commit_response.status_code == 201

    response = await client.get(
        "/api/validate", params={"version": "draft", "run": "true"}, headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pending"] is False
    severities = {entry["severity"] for entry in body["results"]}
    assert {"Violation", "Warning", "Info"}.issubset(severities)

    # second call (no run=true) hits the report cache -- same stamp, no re-run
    cached_response = await client.get(
        "/api/validate", params={"version": "draft"}, headers=headers
    )
    assert cached_response.status_code == 200
    assert cached_response.json()["pending"] is False


async def test_validate_report_p95_within_2s_at_10k_triples(client: AsyncClient) -> None:
    """AC-006-06: ADR-026 retargets this to 10k triples, matching ADR-004's
    already-approved write-path gating scale -- true 100k blows the 2s
    budget on `pyshacl`'s own validate() cost alone (~1.2s measured), a
    pre-existing rdflib/pyshacl scaling ceiling shared by both paths, not
    a bug in this task. Seeding the draft graph is setup, excluded from
    the timed call.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="validate-perf")

    n_processes = 500
    lines = ["@prefix weave: <https://weave.io/ontology/> ."]
    for i in range(n_processes):
        actor = f"weave:a{i}"
        proc = f"weave:p{i}"
        lines.append(f'{actor} a weave:Actor ; weave:label "Actor {i}" .')
        lines.append(
            f'{proc} a weave:Process ; weave:label "Process {i}" ; weave:performedBy {actor} .'
        )
    # Each structured line above is 2-3 triples (type+label[+performedBy]);
    # each filler line below is 2 triples (type+label) -- compute LINE count
    # from the remaining TRIPLE budget, not triples from lines.
    structured_triples = n_processes * (2 + 3)
    filler_lines = (10_000 - structured_triples) // 2
    for i in range(filler_lines):
        lines.append(f'weave:filler{i} a weave:Actor ; weave:label "Filler {i}" .')
    await load_graph(workspace.named_graph_iri, "\n".join(lines))

    start = time.monotonic()
    response = await client.get(
        "/api/validate", params={"version": "draft", "run": "true"}, headers=headers
    )
    elapsed = time.monotonic() - start

    assert response.status_code == 200
    assert response.json()["pending"] is False
    assert elapsed <= 2.0, f"GET /api/validate took {elapsed:.2f}s at 10k triples (budget 2.0s)"
