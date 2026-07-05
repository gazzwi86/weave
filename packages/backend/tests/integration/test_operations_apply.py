"""CE-TASK-001 integration tests: the full CE-WRITE-1 mutation pipeline
against a real Oxigraph + Postgres + Redis stack (AC-001-01/-07/-08/-09/-10).

E2E deviation (recorded, same call as `test_workspace_switch_e2e.py`'s
precedent): the brief asks for the two E2E rows (valid mutation reflects in
the graph; violating mutation surfaces a 422) as Playwright specs, but no
mutation UI exists yet (CE-TASK-006). This codebase's established pattern
for "no UI yet" E2E slots is an API-level test through the real FastAPI app
(`httpx.ASGITransport`) against real docker-compose services, marked
`pytest.mark.e2e` alongside `integration`/`docker` -- not a mocked-network
Playwright spec (PROJ-006 already bans mocked-network e2e; a fresh
harness-bootstrap endpoint to give Playwright an HTTP-only setup path would
duplicate this precedent, not improve on it). `test_valid_mutation_...` and
`test_shacl_violation_...` below are marked `e2e` for that reason. Replace
with a browser-driven Playwright spec once TASK-006 ships the authoring UI.
"""

from __future__ import annotations

import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from rdflib import RDF, Graph, Namespace

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.keys import KEY_ID, PRIVATE_KEY
from weave_backend.mock_oidc.tokens import ISSUER, issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

WEAVE = Namespace("https://weave.io/ontology/")

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
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug=label, display_name=label
        )
    return workspace


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


def _valid_operations() -> list[dict[str, object]]:
    return [
        {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"},
        {"op": "add_edge", "subject_ref": "p1", "predicate": "performedBy", "object_ref": "a1"},
    ]


async def test_valid_mutation_commits_new_version_and_reflects_in_the_graph(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-01/-010 -- also this task's E2E row: a valid mutation, applied
    through the real HTTP endpoint, is visible in the real working graph.
    """
    tenant_id = _unique_tenant("ops-valid")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )

        assert response.status_code == 201
        body = response.json()
        assert body["applied_count"] == 3
        assert body["version_iri"].startswith(f"{workspace.named_graph_iri}:v")
        assert body["activity_iri"]

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "Invoicing" in turtle
        assert "performedBy" in turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_shacl_violation_returns_422_and_leaves_working_graph_unchanged(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-02/-010 -- also this task's second E2E row."""
    tenant_id = _unique_tenant("ops-violate")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        pre_state = await fetch_graph_turtle(workspace.named_graph_iri)

        # A Process with no `performedBy` -- trips ProcessShape's Violation.
        response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )

        assert response.status_code == 422
        assert response.json()["violations"]

        post_state = await fetch_graph_turtle(workspace.named_graph_iri)
        assert post_state == pre_state
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_partial_update_round_trip_preserves_untouched_triples(
    client: AsyncClient, platform_stack: Path
) -> None:
    """DoD: "partial-update round-trip preserves untouched triples
    (integration-verified)" -- two real, separate mutations against the real
    working graph (AC-001-06).
    """
    tenant_id = _unique_tenant("ops-partial")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )

    try:
        create_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert create_response.status_code == 201

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        graph = Graph()
        graph.parse(data=turtle, format="turtle")
        process_iri = str(next(graph.subjects(RDF.type, WEAVE.Process)))

        update_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {
                        "op": "update_node",
                        "iri": process_iri,
                        "properties": {"label": "Invoicing (renamed)"},
                    }
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )
        assert update_response.status_code == 201

        final_turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "Invoicing (renamed)" in final_turtle
        # The performedBy edge asserted in the first mutation was never
        # named by the update -- it must survive untouched.
        assert "performedBy" in final_turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_idempotent_replay_returns_original_response_without_reapplying(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-04."""
    tenant_id = _unique_tenant("ops-idem")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-author", role="author", email="author@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    idempotency_key = f"idem-{uuid.uuid4().hex}"

    try:
        payload = {
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "idempotency_key": idempotency_key,
        }
        first = await client.post("/api/operations/apply", json=payload, headers=headers)
        second = await client.post("/api/operations/apply", json=payload, headers=headers)

        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json() == second.json()
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_missing_jwt_returns_401_before_any_graph_operation(client: AsyncClient) -> None:
    """AC-001-07."""
    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
    )
    assert response.status_code == 401


async def test_expired_jwt_returns_401(client: AsyncClient) -> None:
    """AC-001-07."""
    now = int(time.time())
    expired_claims = {
        "sub": "u-expired",
        "tenant_id": "tenant-expired",
        "principal_iri": "urn:weave:principal:human:u-expired",
        "principal_type": "human",
        "iss": ISSUER,
        "aud": "weave-dev",
        "iat": now - 600,
        "exp": now - 1,
    }
    expired_token = jwt.encode(
        expired_claims, PRIVATE_KEY, algorithm="RS256", headers={"kid": KEY_ID}
    )

    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


async def test_read_only_role_gets_403_not_write_access(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-08."""
    tenant_id = _unique_tenant("ops-forbidden")
    workspace = await _make_workspace(tenant_id, label="ops")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-reader", role="read", email="reader@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-reader", workspace_id=workspace.id
    )

    response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )

    assert response.status_code == 403


async def test_forged_cross_tenant_target_is_rejected(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-001-09: a caller can never write to another tenant's graph, even
    by naming its version IRI directly in `target`.
    """
    tenant_a = _unique_tenant("ops-tenant-a")
    tenant_b = _unique_tenant("ops-tenant-b")
    workspace_a = await _make_workspace(tenant_a, label="ops")
    workspace_b = await _make_workspace(tenant_b, label="ops")
    await _add_member(
        tenant_a, workspace_a.id, user_sub="u-a", role="author", email="a@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_a, user_sub="u-a", workspace_id=workspace_a.id
    )

    forged_target = f"{workspace_b.named_graph_iri}:v0.1.0"
    response = await client.post(
        "/api/operations/apply",
        json={
            "operations": _valid_operations(),
            "actor": "urn:weave:principal:test-actor",
            "target": forged_target,
        },
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_target"
