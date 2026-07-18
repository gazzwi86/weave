"""CE-TASK-005 integration tests: tenant-scoped governance shapes (NL->SHACL,
isolation, cross-worker cache invalidation) against a real Oxigraph +
Postgres + Redis stack (AC-005-01/-02/-03/-04/-07). Same lane conventions as
`test_operations_apply.py` (`pytest.mark.integration`/`docker`, `platform_stack`
fixture, real FastAPI app via `httpx.ASGITransport`).

E2E deviation (recorded, same call as `test_operations_apply.py`'s
precedent): no rules-authoring UI ships yet (CE-TASK-006), so the E2E row
walks the full NL-describe -> preview -> approve -> enforce loop through the
real app instead of a browser flow, marked `e2e` alongside `integration`/
`docker`. Its NL text is the brief's illustrative "every Process must name
an owner" wording, but the shipped ontology has no `owner` predicate (a
tenant shape's `sh:property` path must be a known BPMO predicate -- see
`authoring/shapes.py::_known_predicate_local_names`) -- so the mocked AI
candidate targets the nearest real equivalent, `weave:description` on
`weave:Activity`, exercising identical AC-005-01/-02 machinery end-to-end.

Law F (no live model calls): the AI-generation boundary
(`generate_candidate_shape`) is mocked/monkeypatched at the router import
site in the two tests that touch it (503 and E2E) -- the same boundary
`test_governance_router.py`'s unit tests patch -- everything else in the
request (auth, RBAC, Postgres, Oxigraph, Redis) is real.
"""

from __future__ import annotations

import multiprocessing
import shutil
import uuid
from collections.abc import AsyncIterator
from multiprocessing import Queue as MPQueue
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from rdflib import RDF, Graph, URIRef
from rdflib.namespace import PROV, SH

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.operations.shacl import tenant_shapes_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

#: A tenant shape requiring `weave:description` (a known predicate --
#: framework.shacl.ttl already carries it at `sh:Warning` for Activity) at
#: `sh:Violation` severity. Framework alone only warns on a missing
#: description (never blocks); this tenant shape is what turns it into a
#: 422. Isolated per-test data always uses fresh `weave:Activity` nodes, so
#: this fixed shape IRI is safe to reuse across tests.
_DESCRIPTION_REQUIRED_SHAPE_TTL = """
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


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _bare_activity_op(ref: str) -> dict[str, object]:
    """An `Activity` add with no `description` -- passes framework-only
    validation (Warning, not Violation) but trips the tenant shape above.
    """
    return {"op": "add_node", "ref": ref, "kind": "Activity", "label": f"Activity {ref}"}


def _bare_actor_op(ref: str) -> dict[str, object]:
    """An `Actor` add with a `label` (framework's own `ActorShape` requires
    it) but no `description` -- passes framework-only validation and only
    trips a tenant shape that separately targets `weave:Actor`.
    """
    return {"op": "add_node", "ref": ref, "kind": "Actor", "label": f"Actor {ref}"}


#: A *second*, differently-targeted tenant shape (Actor, not Activity) --
#: reuses `weave:description` (already known-predicate-safe) on a different
#: `sh:targetClass` so the edge test below doesn't need to discover a new
#: predicate to prove two shapes coexist.
_ACTOR_DESCRIPTION_REQUIRED_SHAPE_TTL = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<https://weave.io/instances/shape-actor-description-required> a sh:NodeShape ;
    sh:targetClass weave:Actor ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Every Actor must carry a description."@en ;
    ] .
"""


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


async def _add_admin(tenant_id: str, workspace_id: str, *, user_sub: str, email: str) -> None:
    """One `admin` member outranks the `author` min-role `/api/operations/apply`
    needs (`ROLE_RANK`) and satisfies `require_tenant_admin`'s tenant-wide
    (not workspace-scoped) gate on the shapes routes -- a single member
    exercises both surfaces this task touches.
    """
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace_id, email=email, role="admin"
        )
        await activate_member(conn, workspace_id=workspace_id, email=email, user_sub=user_sub)


async def _authed_headers(
    client: AsyncClient, *, tenant_id: str, user_sub: str, workspace_id: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(f"/api/workspaces/{workspace_id}/switch", headers=headers)
    assert switch_response.status_code == 200
    return headers


async def test_committed_governance_shape_enforced_on_very_next_commit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-02: a shape committed via the NL-authoring surface is enforced
    on the very next CE-WRITE-1 commit -- two-commit sequence (before/after).
    """
    tenant_id = _unique_tenant("gov-enforce")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        before = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act1")], "actor": "urn:weave:principal:t"},
            headers=headers,
        )
        assert before.status_code == 201, before.text

        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text

        after = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act2")], "actor": "urn:weave:principal:t"},
            headers=headers,
        )
        assert after.status_code == 422, after.text
        assert after.json()["violations"]
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


async def test_tenant_a_shape_does_not_leak_into_tenant_b_writes(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-03/-04 -- the release-gating cross-tenant shape-leak test:
    tenant A commits a shape; tenant B's identical write passes/fails
    identically to before the commit (never affected by another tenant's
    governance rule).
    """
    tenant_a = _unique_tenant("gov-leak-a")
    tenant_b = _unique_tenant("gov-leak-b")
    workspace_a = await _make_workspace(tenant_a, label="gov")
    workspace_b = await _make_workspace(tenant_b, label="gov")
    await _add_admin(tenant_a, workspace_a.id, user_sub="u-a", email="a@example.invalid")
    await _add_admin(tenant_b, workspace_b.id, user_sub="u-b", email="b@example.invalid")
    headers_a = await _authed_headers(
        client, tenant_id=tenant_a, user_sub="u-a", workspace_id=workspace_a.id
    )
    headers_b = await _authed_headers(
        client, tenant_id=tenant_b, user_sub="u-b", workspace_id=workspace_b.id
    )

    try:
        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers_a,
        )
        assert commit_response.status_code == 201, commit_response.text

        # Tenant B never committed a shape -- its bare Activity must still
        # pass exactly as it would have before tenant A's commit existed.
        response_b = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act-b")], "actor": "urn:weave:principal:t"},
            headers=headers_b,
        )
        assert response_b.status_code == 201, response_b.text
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_a))


async def test_second_shape_commit_does_not_replace_first_shape_same_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Edge case (QA-added): `commit_tenant_shape` writes via `append_graph`
    (additive), never `load_graph` (replace-whole-graph) -- per
    `operations/governance_shapes.py`'s own module docstring. Committing a
    *second*, differently-targeted shape must not silently drop the first:
    both must still be independently enforced afterwards.
    """
    tenant_id = _unique_tenant("gov-multi-shape")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        first_commit = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert first_commit.status_code == 201, first_commit.text

        second_commit = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _ACTOR_DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert second_commit.status_code == 201, second_commit.text

        # The second (Actor) shape is enforced...
        actor_response = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_actor_op("actor1")], "actor": "urn:weave:principal:t"},
            headers=headers,
        )
        assert actor_response.status_code == 422, actor_response.text

        # ...and the first (Activity) shape is *still* enforced, proving the
        # second commit did not replace the tenant's shapes graph.
        activity_response = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act1")], "actor": "urn:weave:principal:t"},
            headers=headers,
        )
        assert activity_response.status_code == 422, activity_response.text
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


async def test_shape_commit_stamps_prov_o_with_llm_generator_and_human_approver(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-01: the committed shape's PROV-O activity (in the real
    Oxigraph-backed prov graph) attributes the LLM as generator and the
    human as approver -- two distinct agents, distinguishable by role.
    """
    tenant_id = _unique_tenant("gov-prov")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": True},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text
        activity_iri = URIRef(commit_response.json()["activity_iri"])

        prov_turtle = await fetch_graph_turtle(prov_graph_iri(tenant_shapes_graph_iri(tenant_id)))
        graph = Graph()
        graph.parse(data=prov_turtle, format="turtle")

        associated = set(graph.objects(activity_iri, PROV.wasAssociatedWith))
        assert len(associated) == 2, associated
        assert any(PROV.Person in graph.objects(agent, RDF.type) for agent in associated)
        assert any(PROV.SoftwareAgent in graph.objects(agent, RDF.type) for agent in associated)
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))
        await clear_graph(prov_graph_iri(tenant_shapes_graph_iri(tenant_id)))


#: G2 (remediation-2-api-gaps.md, ADR-028): two versions of the SAME
#: `sh:NodeShape` subject, differing only in severity -- the second commit
#: must REPLACE the first's `sh:property` closure, not stack a second one
#: alongside it. A `sh:Violation` blocks `/api/operations/apply` with 422;
#: `sh:Warning` does not -- so the edit's effect is directly observable
#: through the write gate, not just by graph inspection.
_EDIT_SHAPE_IRI = "https://weave.io/instances/shape-edit-target"
_EDIT_SHAPE_VIOLATION_TTL = f"""
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<{_EDIT_SHAPE_IRI}> a sh:NodeShape ;
    sh:targetClass weave:Activity ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Every Activity must carry a description."@en ;
    ] .
"""
_EDIT_SHAPE_WARNING_TTL = f"""
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<{_EDIT_SHAPE_IRI}> a sh:NodeShape ;
    sh:targetClass weave:Activity ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Warning ;
        sh:message "An Activity should carry a description."@en ;
    ] .
"""


async def test_recommitting_same_shape_iri_replaces_not_stacks_the_constraint(
    client: AsyncClient, platform_stack: Path
) -> None:
    """G2: re-committing `_EDIT_SHAPE_IRI` with a Warning-severity property
    must fully replace the earlier Violation-severity property -- if the
    old triples were still present (append-only bug), the write below
    would still 422 on the stacked Violation.
    """
    tenant_id = _unique_tenant("gov-edit")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        first_commit = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _EDIT_SHAPE_VIOLATION_TTL, "ai_generated": False},
            headers=headers,
        )
        assert first_commit.status_code == 201, first_commit.text

        blocked = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act-before-edit")], "actor": "urn:weave:t"},
            headers=headers,
        )
        assert blocked.status_code == 422, blocked.text

        second_commit = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _EDIT_SHAPE_WARNING_TTL, "ai_generated": False},
            headers=headers,
        )
        assert second_commit.status_code == 201, second_commit.text

        allowed = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act-after-edit")], "actor": "urn:weave:t"},
            headers=headers,
        )
        assert allowed.status_code == 201, allowed.text

        turtle = await fetch_graph_turtle(tenant_shapes_graph_iri(tenant_id))
        graph = Graph()
        graph.parse(data=turtle, format="turtle")
        properties = list(graph.objects(URIRef(_EDIT_SHAPE_IRI), URIRef(str(SH.property))))
        assert len(properties) == 1, "second commit must replace, not stack, the property node"
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


async def test_editing_one_shape_leaves_unrelated_tenant_shape_untouched(
    client: AsyncClient, platform_stack: Path
) -> None:
    """G2/ADR-028: retract is scoped to the incoming shape's OWN subject --
    re-committing `_EDIT_SHAPE_IRI` must not touch the unrelated
    `_ACTOR_DESCRIPTION_REQUIRED_SHAPE_TTL` shape committed alongside it.
    """
    tenant_id = _unique_tenant("gov-edit-scope")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        for turtle in (_EDIT_SHAPE_VIOLATION_TTL, _ACTOR_DESCRIPTION_REQUIRED_SHAPE_TTL):
            commit_response = await client.post(
                "/api/ontology/authoring/nl/shapes/commit",
                json={"shape_turtle": turtle, "ai_generated": False},
                headers=headers,
            )
            assert commit_response.status_code == 201, commit_response.text

        re_edit = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _EDIT_SHAPE_WARNING_TTL, "ai_generated": False},
            headers=headers,
        )
        assert re_edit.status_code == 201, re_edit.text

        # The unrelated Actor shape must still be enforced after the edit.
        actor_response = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_actor_op("actor-untouched")], "actor": "urn:weave:t"},
            headers=headers,
        )
        assert actor_response.status_code == 422, actor_response.text
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


async def test_retiring_a_shape_stops_it_being_enforced_and_listed(
    client: AsyncClient, platform_stack: Path
) -> None:
    """G3: after `DELETE /api/ontology/authoring/shapes`, the retired
    shape's rule no longer blocks writes, and `GET /api/validate`'s rule
    catalogue no longer lists it (both read the same shapes-graph state).
    """
    tenant_id = _unique_tenant("gov-retire")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text
        shape_iri = commit_response.json()["shape_iri"]

        retire_response = await client.request(
            "DELETE",
            "/api/ontology/authoring/shapes",
            params={"shape_iri": shape_iri},
            headers=headers,
        )
        assert retire_response.status_code == 204, retire_response.text

        allowed = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act-after-retire")], "actor": "urn:weave:t"},
            headers=headers,
        )
        assert allowed.status_code == 201, allowed.text

        report = await client.get(
            "/api/validate",
            # version="draft" -- operations/apply mints a draft row only
            # (publish is a separate lifecycle step), and the default
            # version="latest" resolves to the newest PUBLISHED version
            # only (versioning.resolve_version), so it 404s here with no
            # publish ever having happened. Matches every other run=true
            # integration assertion in test_validate_api.py.
            params={"workspace_id": workspace.id, "run": "true", "version": "draft"},
            headers=headers,
        )
        assert report.status_code == 200, report.text
        rule_iris = {rule["shape_iri"] for rule in report.json()["rules"]}
        assert shape_iri not in rule_iris

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT event_type, target_iri FROM audit_entries"
                " WHERE tenant_id = $1 AND event_type = 'governance.shape_retired'",
                tenant_id,
            )
        assert len(rows) == 1
        assert rows[0]["target_iri"] == shape_iri
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


#: Council finding (ADR-028 follow-up): `_retract_shape_subject_closure`'s
#: SPARQL property path traverses THROUGH named nodes it passes on the way
#: to a blank node, so a shape B *referenced* from shape A (e.g. via
#: `sh:node`) had its own `sh:property` blank-node children swept into A's
#: retraction even though B itself is a distinct, independently-committed
#: shape. `_LINKED_SHAPE_B_IRI` is committed on its own first (the
#: realistic case -- a shared shape other shapes point at); `_LINKED_SHAPE_A_TTL`
#: then references it purely by IRI via a top-level `sh:node`, without
#: redeclaring any of B's own triples -- exactly the "shape A referencing
#: shape B" structural shape a retract must never reach through.
_LINKED_SHAPE_B_IRI = "https://weave.io/instances/shape-linked-b"
_LINKED_SHAPE_B_TTL = f"""
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<{_LINKED_SHAPE_B_IRI}> a sh:NodeShape ;
    sh:targetClass weave:Actor ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Every Actor must carry a description."@en ;
    ] .
"""
_LINKED_SHAPE_A_IRI = "https://weave.io/instances/shape-linked-a"
_LINKED_SHAPE_A_TTL = f"""
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<{_LINKED_SHAPE_A_IRI}> a sh:NodeShape ;
    sh:targetClass weave:Activity ;
    sh:node <{_LINKED_SHAPE_B_IRI}> ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Every Activity must carry a description."@en ;
    ] .
"""


async def test_retiring_a_shape_leaves_a_shape_it_references_via_sh_node_fully_intact(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Council finding: retiring shape A (which points at shape B via
    `sh:node`) must not touch B's own triples or B's `sh:property` blank
    node -- B is a distinct, independently-committed shape reached only in
    passing while walking A's closure.
    """
    tenant_id = _unique_tenant("gov-linked")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        commit_b = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _LINKED_SHAPE_B_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_b.status_code == 201, commit_b.text

        commit_a = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _LINKED_SHAPE_A_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_a.status_code == 201, commit_a.text

        retire_response = await client.request(
            "DELETE",
            "/api/ontology/authoring/shapes",
            params={"shape_iri": _LINKED_SHAPE_A_IRI},
            headers=headers,
        )
        assert retire_response.status_code == 204, retire_response.text

        # B's own rule must still block -- proves B's sh:property blank
        # node (sh:path/sh:minCount/sh:severity) is still fully present.
        actor_response = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_actor_op("actor-linked")], "actor": "urn:weave:t"},
            headers=headers,
        )
        assert actor_response.status_code == 422, actor_response.text

        turtle = await fetch_graph_turtle(tenant_shapes_graph_iri(tenant_id))
        graph = Graph()
        graph.parse(data=turtle, format="turtle")
        assert (URIRef(_LINKED_SHAPE_B_IRI), RDF.type, SH.NodeShape) in graph
        b_properties = list(graph.objects(URIRef(_LINKED_SHAPE_B_IRI), URIRef(str(SH.property))))
        assert len(b_properties) == 1, "B's sh:property blank node must survive A's retraction"
        b_property_node = b_properties[0]
        assert (b_property_node, URIRef(str(SH.minCount)), None) in graph
        assert (b_property_node, URIRef(str(SH.path)), None) in graph
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


async def test_retiring_an_unknown_shape_returns_404(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("gov-retire-404")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        response = await client.request(
            "DELETE",
            "/api/ontology/authoring/shapes",
            params={"shape_iri": "https://weave.io/instances/shape-never-committed"},
            headers=headers,
        )
        assert response.status_code == 404, response.text
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_retiring_a_framework_shape_returns_403(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("gov-retire-403")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    try:
        response = await client.request(
            "DELETE",
            "/api/ontology/authoring/shapes",
            params={"shape_iri": "https://weave.io/ontology/ProcessShape"},
            headers=headers,
        )
        assert response.status_code == 403, response.text
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_ai_provider_unavailable_returns_503_and_raw_shacl_path_stays_live(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-07: the AI service being unreachable 503s the NL preview
    surface, but the raw-SHACL commit path (no AI involved) stays live.
    """
    tenant_id = _unique_tenant("gov-ai-down")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    with patch(
        "weave_backend.routers.governance.generate_candidate_shape",
        side_effect=ConnectionError("refused"),
    ):
        preview_response = await client.post(
            "/api/ontology/authoring/nl/shapes/preview",
            json={"text": "every Activity must have a description"},
            headers=headers,
        )
    assert preview_response.status_code == 503
    assert preview_response.json()["detail"] == {"error": "model_provider_unavailable"}

    try:
        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text
    finally:
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


def _worker_validate_activity(
    tenant_id: str, cmd_queue: MPQueue[str], result_queue: MPQueue[bool]
) -> None:
    """Runs in a genuinely separate OS process (spawn context, own
    interpreter, own import of `operations/shacl`'s module-level cache) --
    proves cache invalidation is driven by the shared Redis version token,
    not any in-process signal, so a *warm* per-process cache still picks up
    another process's shape commit on its very next validation
    (FR-025: the process-local-caching bug this test exists to catch).
    """
    import asyncio
    import os

    os.environ.setdefault("WEAVE_ENV", "test")
    from rdflib import RDF, XSD, Graph, Literal, Namespace

    from weave_backend.operations import shacl
    from weave_backend.tenancy.sessions import get_redis

    weave_ns = Namespace("https://weave.io/ontology/")
    instances = Namespace("https://weave.io/instances/")

    def _graph() -> Graph:
        g = Graph()
        g.add((instances["worker-activity"], RDF.type, weave_ns.Activity))
        g.add((instances["worker-activity"], weave_ns.label, Literal("Bare", datatype=XSD.string)))
        return g

    async def _validate_once() -> bool:
        # Same `Any` escape hatch as `routers/governance.py`/`pipeline.py`:
        # redis-py's concrete `Redis` doesn't structurally satisfy
        # `RedisLike` under mypy, only matters for the real runtime object.
        redis_client: Any = get_redis()
        results = await shacl.validate_graph_for_tenant(
            _graph(), tenant_id=tenant_id, redis_client=redis_client
        )
        return any(
            r.severity == "Violation" and r.path == str(weave_ns.description) for r in results
        )

    while True:
        cmd = cmd_queue.get()
        if cmd == "stop":
            return
        result_queue.put(asyncio.run(_validate_once()))


async def test_shape_commit_invalidates_cache_across_worker_processes(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-02: two independent OS processes (not two in-process cache
    clears) sharing the same Redis -- a shape commit made through this
    process's HTTP call is picked up by the *other*, already-warm
    process's very next validation, with no restart and no direct
    signalling between them.
    """
    tenant_id = _unique_tenant("gov-multiproc")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(tenant_id, workspace.id, user_sub="u-admin", email="admin@example.invalid")
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )

    ctx = multiprocessing.get_context("spawn")
    cmd_queue: MPQueue[str] = ctx.Queue()
    result_queue: MPQueue[bool] = ctx.Queue()
    worker = ctx.Process(
        target=_worker_validate_activity, args=(tenant_id, cmd_queue, result_queue)
    )
    worker.start()
    try:
        cmd_queue.put("validate")
        before_blocked = result_queue.get(timeout=15)
        assert before_blocked is False

        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": _DESCRIPTION_REQUIRED_SHAPE_TTL, "ai_generated": False},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text

        cmd_queue.put("validate")
        after_blocked = result_queue.get(timeout=15)
        assert after_blocked is True
    finally:
        cmd_queue.put("stop")
        worker.join(timeout=10)
        if worker.is_alive():
            worker.terminate()
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))


@pytest.mark.e2e
async def test_compliance_officer_describes_rule_approves_then_ownerless_edit_is_blocked(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-005-01/-02 -- this task's E2E row (see module docstring for the
    NL-text/predicate substitution and the "no UI yet" API-level precedent).
    """
    tenant_id = _unique_tenant("gov-e2e")
    workspace = await _make_workspace(tenant_id, label="gov")
    await _add_admin(
        tenant_id, workspace.id, user_sub="u-compliance", email="compliance@example.invalid"
    )
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-compliance", workspace_id=workspace.id
    )
    candidate_graph = Graph()
    candidate_graph.parse(data=_DESCRIPTION_REQUIRED_SHAPE_TTL, format="turtle")

    try:
        with patch(
            "weave_backend.routers.governance.generate_candidate_shape",
            return_value=candidate_graph,
        ):
            preview_response = await client.post(
                "/api/ontology/authoring/nl/shapes/preview",
                json={"text": "every Activity must name an owner-visible description"},
                headers=headers,
            )
        assert preview_response.status_code == 200, preview_response.text
        shape_turtle = preview_response.json()["shape_turtle"]

        commit_response = await client.post(
            "/api/ontology/authoring/nl/shapes/commit",
            json={"shape_turtle": shape_turtle, "ai_generated": True},
            headers=headers,
        )
        assert commit_response.status_code == 201, commit_response.text

        blocked_response = await client.post(
            "/api/operations/apply",
            json={"operations": [_bare_activity_op("act-e2e")], "actor": "urn:weave:principal:t"},
            headers=headers,
        )
        assert blocked_response.status_code == 422, blocked_response.text
        assert blocked_response.json()["violations"]
    finally:
        await clear_graph(workspace.named_graph_iri)
        await clear_graph(tenant_shapes_graph_iri(tenant_id))
