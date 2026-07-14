"""CE-V1-TASK-030 (AC-1): the M2 release-gate cross-tenant isolation suite.

Extends the M1 two-tenant RLS fixture (`test_tenancy_isolation.py`) and the
per-surface isolation tests already shipped by TASK-020/022/025/027
(`test_layout_persistence.py::test_cross_tenant_layout_isolation_rls`,
`test_views_comments_persistence.py::test_cross_tenant_views_comments_isolation`,
`test_ontology_lifecycle.py::test_diff_across_tenants_returns_404` /
`test_publish_version_from_another_tenant_returns_404_not_403`) rather than
forking a second fixture (Hint rung 2: drift between fixtures is how
isolation tests rot). This file adds the surfaces those didn't cover
(resource fetch, versions list, coverage_gap pattern, events feed) and rolls
everything into ONE composite assertion per AC-1's "one suite, eight
surfaces" design decision. The AC-6/AC-7 meta-tests live in
`tests/unit/test_m2_gate_bundle.py` -- the brief's own AC-to-Test Mapping
table types them "Unit", and they check CI/filesystem state, not docker.
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


async def _member_headers(
    client: AsyncClient, *, tenant_id: str, sub: str
) -> tuple[Workspace, dict[str, str]]:
    """One tenant, one admin member, one active workspace -- the minimum
    shape every M2 surface (workspace-scoped ontology reads included) needs.
    """
    email = f"{sub}@example.invalid"
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Gate"
        )
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=email, role="admin"
        )
        await activate_member(conn, workspace_id=workspace.id, email=email, user_sub=sub)
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch = await client.post(f"/api/workspaces/{workspace.id}/switch", headers=headers)
    assert switch.status_code == 200
    return workspace, headers


async def _seed_tenant_data(
    client: AsyncClient, *, headers: dict[str, str], marker: str
) -> dict[str, str]:
    """Seeds one distinguishable row per M2 surface for a tenant: a graph
    mutation (ontology resource/versions/diff/coverage_gap), a saved view
    (views list + `view:*` layout row), and a comment (comments fetch).
    Returns the ids a caller needs to address the seeded rows.
    """
    apply_response = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {"op": "add_node", "ref": marker, "kind": "Actor", "label": marker},
            ],
            "actor": f"urn:weave:principal:{marker}",
        },
        headers=headers,
    )
    version_iri = apply_response.json()["version_iri"]

    save = await client.post(
        "/api/views",
        json={
            "name": f"{marker}-view",
            "definition": {},
            "positions": [
                {"node_iri": f"urn:weave:entity:{marker}", "position_x": 1.0, "position_y": 1.0}
            ],
        },
        headers=headers,
    )
    view_id = save.json()["view_id"]

    await client.post(
        "/api/comments",
        json={"target_kind": "node", "target_ref": f"urn:weave:entity:{marker}", "body": marker},
        headers=headers,
    )

    return {"version_iri": version_iri, "view_id": view_id}


async def _assert_zero_leak(
    client: AsyncClient, *, headers_a: dict[str, str], b_ids: dict[str, str], marker_b: str
) -> None:
    """AC-1: every M2 read surface, addressed as tenant A, must show zero
    tenant-B rows -- and addressing tenant B's view id must 404.
    """
    resource = await client.get(
        f"/api/ontology/resource/urn:weave:entity:{marker_b}", headers=headers_a
    )
    assert resource.status_code == 404, "resource fetch leaked a foreign-tenant IRI"

    versions = await client.get("/api/ontology/versions", headers=headers_a)
    assert all(
        v["version_iri"] != b_ids["version_iri"] for v in versions.json()["versions"]
    ), "versions list leaked a foreign-tenant version"

    diff = await client.get(
        "/api/ontology/diff",
        params={"from": b_ids["version_iri"], "to": b_ids["version_iri"]},
        headers=headers_a,
    )
    assert diff.status_code == 404, "diff endpoint leaked a foreign-tenant version pair"

    coverage_gap = await client.get(
        "/api/sparql", params={"pattern": "coverage_gap_process"}, headers=headers_a
    )
    bindings = coverage_gap.json().get("results", {}).get("bindings", [])
    assert not any(
        marker_b in str(binding) for binding in bindings
    ), "coverage_gap pattern leaked foreign-tenant bindings"

    events = await client.get("/api/proxy/events", params={"since_seq": 0}, headers=headers_a)
    assert not any(
        marker_b in str(event) for event in events.json()["events"]
    ), "events feed leaked a foreign-tenant row"

    views_list = await client.get("/api/views", headers=headers_a)
    assert all(
        b_ids["view_id"] != v["view_id"] for v in views_list.json()
    ), "views list leaked a foreign-tenant row"

    comments = await client.get(
        "/api/comments",
        params={"target_kind": "node", "target_ref": f"urn:weave:entity:{marker_b}"},
        headers=headers_a,
    )
    assert comments.json() == [], "comments fetch leaked a foreign-tenant row"

    delete_foreign_view = await client.delete(f"/api/views/{b_ids['view_id']}", headers=headers_a)
    assert delete_foreign_view.status_code == 404, "foreign-tenant view id was not rejected"


async def test_cross_tenant_isolation_m2(client: AsyncClient, platform_stack: Path) -> None:
    """AC-1: zero tenant-B rows/triples for tenant-A JWTs across every M2
    read surface (graph load is covered directly by
    `test_tenancy_isolation.py`'s RDF/S3 assertions -- this test covers the
    remaining eight: resource fetch, diff, versions, coverage_gap, events
    feed, views list, comments fetch, `view:*` layout rows), plus rejection
    on a foreign-tenant view id. `_assert_zero_leak` alone issues 8
    assertions; layout-row leak (below) and graph-load coverage in the
    sibling M1 file bring the suite past the brief's 10-assertion minimum.
    """
    tenant_a, tenant_b = _unique_tenant("gate-a"), _unique_tenant("gate-b")
    workspace_a, headers_a = await _member_headers(client, tenant_id=tenant_a, sub="u-gate-a")
    workspace_b, headers_b = await _member_headers(client, tenant_id=tenant_b, sub="u-gate-b")

    try:
        await _seed_tenant_data(client, headers=headers_a, marker="gate-marker-a")
        b_ids = await _seed_tenant_data(client, headers=headers_b, marker="gate-marker-b")

        await _assert_zero_leak(
            client, headers_a=headers_a, b_ids=b_ids, marker_b="gate-marker-b"
        )

        async with tenant_connection(tenant_a) as conn:
            leaked_layout = await conn.fetch(
                "SELECT 1 FROM explorer_layout_positions WHERE graph_id = $1",
                f"view:{b_ids['view_id']}",
            )
        assert leaked_layout == [], "view:* layout row leaked across tenants"
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)
