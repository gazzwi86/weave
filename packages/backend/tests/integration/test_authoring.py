"""TASK-004 integration tests: NL, SHACL-form-restriction, and Turtle-import
authoring endpoints against a real Oxigraph + Postgres + Redis stack.

`parse_operations` is patched at the router's import boundary (same call as
`test_briefs_api.py`'s `draft_brief_document` patch) -- `ai.router.route()`
talks to the Anthropic/Bedrock SDK directly, never an in-process engine, so
there's no ASGI transport to swap in the way CE-READ-1's dependency is
overridden elsewhere (Law F: no live LLM calls in tests).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle, run_query
from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, ApplyRequest
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


async def _add_author(tenant_id: str, workspace_id: str, *, user_sub: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email=f"{user_sub}@example.invalid",
            role="author",
        )
        await activate_member(
            conn,
            workspace_id=workspace_id,
            email=f"{user_sub}@example.invalid",
            user_sub=user_sub,
        )


async def _authed_headers(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return headers


async def _authored_workspace(
    client: AsyncClient, label: str
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label=label)
    await _add_author(tenant_id, workspace.id, user_sub="u-author")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


async def test_nl_happy_path_creates_class_and_confirms_iri(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-01 / E2E row 1: modeller text -> committed draft class, IRI
    confirmed back via `ref_map`.
    """
    _, workspace, headers = await _authored_workspace(client, "nl-happy")
    # The Actor + performedBy edge exist only so this stays a clean happy
    # path -- a bare Process would trip ProcessShape's performedBy violation.
    fake_request = ApplyRequest(
        operations=[
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Customer Onboarding"),
            AddNodeOp(op="add_node", ref="a1", kind="Actor", label="Onboarding Team"),
            AddEdgeOp(op="add_edge", subject_ref="p1", predicate="performedBy", object_ref="a1"),
        ],
        actor="urn:weave:principal:test-actor",
    )

    try:
        with patch(
            "weave_backend.routers.authoring.parse_operations", return_value=fake_request
        ):
            response = await client.post(
                "/api/ontology/authoring/nl",
                json={"text": "Add a Process called Customer Onboarding"},
                headers=headers,
            )

        assert response.status_code == 201
        body = response.json()
        assert body["applied_count"] == 3
        assert body["ref_map"]["p1"].startswith("https://weave.io/instances/process-")
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_nl_shacl_violation_returns_422_and_does_not_commit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-03: a Process with no `performedBy` Actor trips
    `ProcessShape`'s violation -- 422, no commit.
    """
    _, workspace, headers = await _authored_workspace(client, "nl-violate")
    fake_request = ApplyRequest(
        operations=[
            AddNodeOp(op="add_node", ref="p1", kind="Process", label="Orphan Process"),
        ],
        actor="urn:weave:principal:test-actor",
    )

    try:
        with patch(
            "weave_backend.routers.authoring.parse_operations", return_value=fake_request
        ):
            response = await client.post(
                "/api/ontology/authoring/nl",
                json={"text": "Add a Process called Orphan Process"},
                headers=headers,
            )

        assert response.status_code == 422
        assert response.json()["violations"]
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_min_cardinality_restriction_commits_and_is_queryable(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-06: "Process cannot have zero Activities" -> committed
    owl:minCardinality restriction.
    """
    _, workspace, headers = await _authored_workspace(client, "restrict-min")

    try:
        response = await client.post(
            "/api/ontology/authoring/restrictions",
            json={
                "restriction_type": "min_cardinality",
                "class_iri": "https://weave.io/instances/process-seed",
                "property_iri": "https://weave.io/ontology/hasActivity",
                "min_count": 1,
            },
            headers=headers,
        )

        assert response.status_code == 201
        assert response.json()["applied_count"] == 2

        results = await run_query(
            "SELECT ?restriction WHERE { "
            "<https://weave.io/instances/process-seed> "
            "<http://www.w3.org/2000/01/rdf-schema#subClassOf> ?restriction . "
            "?restriction <http://www.w3.org/2002/07/owl#minCardinality> 1 . }",
            workspace.named_graph_iri,
        )
        assert len(results["results"]["bindings"]) == 1
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_min_cardinality_conflict_returns_409_before_commit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-08: a new minCardinality that exceeds the caller-reported
    existing maxCardinality is a conflict, surfaced before any dispatch.
    """
    _, workspace, headers = await _authored_workspace(client, "restrict-conflict")

    try:
        response = await client.post(
            "/api/ontology/authoring/restrictions",
            json={
                "restriction_type": "min_cardinality",
                "class_iri": "https://weave.io/instances/process-seed",
                "property_iri": "https://weave.io/ontology/hasActivity",
                "min_count": 5,
                "existing_max_count": 1,
            },
            headers=headers,
        )

        assert response.status_code == 409
        # HTTPException.detail is wrapped by FastAPI's default handler under
        # "detail" -- unlike the collision 409 below, which is a raw
        # JSONResponse (no HTTPException involved) so its keys are top-level.
        assert response.json()["detail"]["error"] == "restriction_conflict"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_disjoint_with_asserted_and_queryable_via_sparql(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-07: "A Process and a DataAsset cannot be the same thing"."""
    _, workspace, headers = await _authored_workspace(client, "disjoint")
    process_iri = "https://weave.io/instances/process-x"
    data_asset_iri = "https://weave.io/instances/dataasset-x"

    try:
        response = await client.post(
            "/api/ontology/authoring/restrictions",
            json={
                "restriction_type": "disjoint_with",
                "class_a_iri": process_iri,
                "class_b_iri": data_asset_iri,
            },
            headers=headers,
        )

        assert response.status_code == 201

        results = await run_query(
            f"ASK {{ <{process_iri}> <http://www.w3.org/2002/07/owl#disjointWith> "
            f"<{data_asset_iri}> }}",
            workspace.named_graph_iri,
        )
        assert results["boolean"] is True
    finally:
        await clear_graph(workspace.named_graph_iri)


_IMPORT_TURTLE = """
@prefix weave: <https://weave.io/ontology/> .
@prefix inst: <https://weave.io/instances/> .

inst:hb-onboarding a weave:Process ;
    weave:label "Customer Onboarding" .

inst:hb-review a weave:Activity ;
    weave:label "Review Application" .
"""

# Own fixture (not shared with the collision test below): that test's
# "existing_class_iris" collision is caller-declared only, never a real node,
# so its Process is never actually dispatched through CE-WRITE-1 and never
# hits ProcessShape. This test imports a real Process into a real graph, so
# it needs the same performedBy Actor the NL happy-path test uses to clear
# ProcessShape's violation.
_IMPORT_TURTLE_WITH_ACTOR = """
@prefix weave: <https://weave.io/ontology/> .
@prefix inst: <https://weave.io/instances/> .

inst:hb-onboarding a weave:Process ;
    weave:label "Customer Onboarding" ;
    weave:performedBy inst:hb-team .

inst:hb-review a weave:Activity ;
    weave:label "Review Application" .

inst:hb-team a weave:Actor ;
    weave:label "Onboarding Team" .
"""


async def test_import_commits_and_reports_counts_then_partial_update_preserves_import(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-10/-12: Turtle import validated and committed with counts.
    AC-004-13: a follow-up `update_node` on the imported class only touches
    the named predicate, leaving the import's own triples (kind, label)
    intact.
    """
    _, workspace, headers = await _authored_workspace(client, "import-commit")

    try:
        response = await client.post(
            "/api/ontology/authoring/import",
            json={"turtle": _IMPORT_TURTLE_WITH_ACTOR},
            headers=headers,
        )

        assert response.status_code == 201
        body = response.json()
        assert body["classes_added"] == 3
        assert body["unknown_kinds"] == []

        update_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {
                        "op": "update_node",
                        "iri": "https://weave.io/instances/hb-onboarding",
                        "properties": {"https://weave.io/ontology/description": "Refined by hand"},
                    }
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )
        assert update_response.status_code == 201

        turtle = await fetch_graph_turtle(workspace.named_graph_iri)
        assert "Customer Onboarding" in turtle
        assert "Refined by hand" in turtle
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_import_collision_requires_decision_then_skip_and_overwrite(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-004-11: a colliding IRI is never silently resolved -- the first
    call returns the collision list; `skip` leaves it untouched, and a
    second colliding subject resolved as `overwrite` updates it in place.
    """
    _, workspace, headers = await _authored_workspace(client, "import-collision")
    existing_iri = "https://weave.io/instances/hb-onboarding"

    try:
        first_response = await client.post(
            "/api/ontology/authoring/import",
            json={"turtle": _IMPORT_TURTLE, "existing_class_iris": [existing_iri]},
            headers=headers,
        )
        assert first_response.status_code == 409
        assert first_response.json()["collision_iris"] == [existing_iri]

        skip_response = await client.post(
            "/api/ontology/authoring/import",
            json={
                "turtle": _IMPORT_TURTLE,
                "existing_class_iris": [existing_iri],
                "on_collision": "skip",
            },
            headers=headers,
        )
        assert skip_response.status_code == 201
        assert skip_response.json()["classes_added"] == 1

        overwrite_response = await client.post(
            "/api/ontology/authoring/import",
            json={
                "turtle": _IMPORT_TURTLE,
                "existing_class_iris": [existing_iri],
                "on_collision": "overwrite",
            },
            headers=headers,
        )
        assert overwrite_response.status_code == 201
    finally:
        await clear_graph(workspace.named_graph_iri)
