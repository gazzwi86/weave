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
from rdflib.namespace import PROV

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
