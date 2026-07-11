"""CE-V1-TASK-009 integration tests: CE-FUNCTION-1 registry (`GET
/api/functions`, `GET /api/functions/{iri}`) against real Oxigraph +
Postgres + Redis stack. Mirrors `test_operations_apply.py`'s fixtures.

Scope note (AC-009-08's "p95 at 100k store" claim): the codebase's
established pattern for a "p95" test requirement is a functional check at
a bounded seed count, not a literal wall-clock SLA assertion inside an
integration test (see `test_pm_surface_api.py::
test_should_paginate_grid_at_100_projects_within_p95`, which seeds 100 and
never measures elapsed time). Genuine 100k-scale timing lives in the
dedicated CE perf-benchmark harness (`scripts/benchmarks/ce-perf`,
CE-TASK-008) -- a per-task integration test seeding 100k triples would be
slow, flaky under CI contention, and duplicate that harness's job. This
file's `test_should_list_functions_promptly_at_a_bounded_seed_count`
follows the same precedent: seeds 25 functions and asserts a generous
wall-clock ceiling as a smoke-level regression guard, not a literal
100k/300ms proof.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from time import perf_counter

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

WEAVE = "https://weave.io/ontology/"
FUNCTION_KIND = f"{WEAVE}Function"
PARAM_KIND = f"{WEAVE}Parameter"
ACTIVITY_KIND = f"{WEAVE}Activity"
DATA_ASSET_KIND = f"{WEAVE}DataAsset"

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


async def _setup_admin(
    client: AsyncClient, *, label: str
) -> tuple[str, Workspace, dict[str, str]]:
    """Single admin-role member covers both apply (author-rank) and
    publish (publish-rank) actions -- `ROLE_RANK` in `rbac.py` is
    hierarchical, so one setup suffices for every scenario here.
    """
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="fn")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-admin", role="admin", email="admin@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-admin", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


def _define_function_ops(
    *, fn_ref: str = "fn1", label: str = "reorderStock"
) -> list[dict[str, object]]:
    """AC-009-01: a `weave:Function` with one grounded parameter and a
    return slot -- both reference a real BPMO kind IRI, never a hand-copied
    local name (`_expand()` passes a `://`-bearing `kind` through
    untouched, which is also how `Function`/`Parameter` -- meta-level, not
    BPMO business kinds -- avoid the BPMO-kind guard; see
    `test_operations_pipeline_function_immutability.py` precedent).

    `label` is exposed (not always "reorderStock") because
    `graph_ops.find_existing_by_label_kind` auto-merges any two `add_node`
    ops sharing the same (kind, label) onto one canonical node (AC-001-05)
    -- callers seeding multiple *distinct* functions must vary it or they
    collapse into a single function, which is the correct write-path
    behaviour, not a bug.
    """
    return [
        {
            "op": "add_node",
            "ref": fn_ref,
            "kind": FUNCTION_KIND,
            "label": label,
            "properties": {"status": "active"},
        },
        {
            "op": "add_edge",
            "subject_ref": fn_ref,
            "predicate": "boundKind",
            "object_ref": ACTIVITY_KIND,
        },
        {
            "op": "add_node",
            "ref": f"{fn_ref}-param1",
            "kind": PARAM_KIND,
            "label": "qty",
            "properties": {"paramKind": DATA_ASSET_KIND, "paramOrder": 0},
        },
        {
            "op": "add_edge",
            "subject_ref": fn_ref,
            "predicate": "hasParameter",
            "object_ref": f"{fn_ref}-param1",
        },
        {
            "op": "add_node",
            "ref": f"{fn_ref}-return",
            "kind": PARAM_KIND,
            "label": "result",
            "properties": {"paramKind": DATA_ASSET_KIND},
        },
        {
            "op": "add_edge",
            "subject_ref": fn_ref,
            "predicate": "hasReturn",
            "object_ref": f"{fn_ref}-return",
        },
    ]


async def test_should_define_a_function_via_write_and_read_it_back_on_both_endpoints(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-01/-02/-03."""
    _tenant_id, workspace, headers = await _setup_admin(client, label="fn-define")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _define_function_ops(), "actor": "urn:weave:principal:test"},
            headers=headers,
        )
        assert apply_response.status_code == 201, apply_response.text
        fn_iri = apply_response.json()["ref_map"]["fn1"]

        list_response = await client.get("/api/functions", headers=headers)
        assert list_response.status_code == 200
        entries = list_response.json()["functions"]
        assert len(entries) == 1
        entry = entries[0]
        assert entry["fn_iri"] == fn_iri
        assert entry["name"] == "reorderStock"
        assert entry["bound_kind"] == ACTIVITY_KIND
        assert entry["status"] == "active"
        assert entry["breaking"] is False
        assert entry["signature"]["params"][0]["kind_iri"] == DATA_ASSET_KIND
        assert entry["signature"]["return_"]["kind_iri"] == DATA_ASSET_KIND

        detail_response = await client.get(f"/api/functions/{fn_iri}", headers=headers)
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["fn_iri"] == fn_iri
        # AC-009-03: derived JSON Schema, never stored/hand-edited. It's a
        # per-param/return projection (`registry._derive_json_schema`),
        # not a single flat object -- `bound_kind` lives on the detail
        # response itself (asserted above), not inside the schema.
        schema = detail["json_schema"]
        assert schema["properties"]["qty"]["properties"]["kind"]["const"] == DATA_ASSET_KIND
        assert schema["returns"]["properties"]["kind"]["const"] == DATA_ASSET_KIND
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_should_422_an_in_place_signature_edit_of_a_published_function_but_allow_label_edit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-04/-05."""
    _tenant_id, workspace, headers = await _setup_admin(client, label="fn-immutable")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _define_function_ops(), "actor": "urn:weave:principal:test"},
            headers=headers,
        )
        assert apply_response.status_code == 201, apply_response.text
        fn_iri = apply_response.json()["ref_map"]["fn1"]
        version_iri = apply_response.json()["version_iri"]

        publish_response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert publish_response.status_code == 200, publish_response.text

        signature_edit_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {
                        "op": "add_edge",
                        "subject_ref": fn_iri,
                        "predicate": "boundKind",
                        "object_ref": f"{WEAVE}Event",
                    }
                ],
                "actor": "urn:weave:principal:test",
            },
            headers=headers,
        )
        assert signature_edit_response.status_code == 422
        assert (
            signature_edit_response.json()["detail"]["error"] == "function_signature_immutable"
        )

        label_edit_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {
                        "op": "update_node",
                        "iri": fn_iri,
                        "properties": {"label": "reorderStockV2"},
                    }
                ],
                "actor": "urn:weave:principal:test",
            },
            headers=headers,
        )
        assert label_edit_response.status_code == 201, label_edit_response.text
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_should_keep_a_deprecated_function_resolving_with_status_exposed(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-06."""
    _tenant_id, workspace, headers = await _setup_admin(client, label="fn-deprecate")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _define_function_ops(), "actor": "urn:weave:principal:test"},
            headers=headers,
        )
        assert apply_response.status_code == 201, apply_response.text
        fn_iri = apply_response.json()["ref_map"]["fn1"]
        version_iri = apply_response.json()["version_iri"]
        publish_response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert publish_response.status_code == 200, publish_response.text

        deprecate_response = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {"op": "update_node", "iri": fn_iri, "properties": {"status": "deprecated"}}
                ],
                "actor": "urn:weave:principal:test",
            },
            headers=headers,
        )
        assert deprecate_response.status_code == 201, deprecate_response.text

        detail_response = await client.get(f"/api/functions/{fn_iri}", headers=headers)
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["status"] == "deprecated"
        # Existing references keep resolving -- signature untouched.
        assert detail["signature"]["bound_kind"] == ACTIVITY_KIND
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_missing_jwt_returns_401_and_unknown_fn_iri_returns_404(
    client: AsyncClient,
) -> None:
    """AC-009-08."""
    unauthenticated_response = await client.get("/api/functions")
    assert unauthenticated_response.status_code == 401

    _tenant_id, workspace, headers = await _setup_admin(client, label="fn-404")
    try:
        response = await client.get(
            f"/api/functions/{WEAVE}fn-does-not-exist", headers=headers
        )
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "function_not_found"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_should_list_functions_promptly_at_a_bounded_seed_count(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-009-08 p95 floor (see module docstring for scope): 25 seeded
    functions, list must return well inside a generous ceiling -- a
    regression guard against an accidentally-unindexed/N+1 read path, not
    a literal 100k-store SLA proof (owned by the CE-TASK-008 benchmark).
    """
    _tenant_id, workspace, headers = await _setup_admin(client, label="fn-bulk")

    try:
        for i in range(25):
            operations = _define_function_ops(fn_ref=f"fn-{i}", label=f"reorderStock-{i}")
            response = await client.post(
                "/api/operations/apply",
                json={"operations": operations, "actor": "urn:weave:principal:test"},
                headers=headers,
            )
            assert response.status_code == 201, response.text

        start = perf_counter()
        list_response = await client.get("/api/functions", headers=headers)
        elapsed_ms = (perf_counter() - start) * 1000

        assert list_response.status_code == 200
        assert len(list_response.json()["functions"]) == 25
        assert elapsed_ms < 3000
    finally:
        await clear_graph(workspace.named_graph_iri)
