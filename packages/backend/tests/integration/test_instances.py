"""CE-TASK-005 integration tests: `/api/instances` CRUD + browse/search
against a real Oxigraph + Postgres + Redis stack.

E2E deviation (same precedent `test_operations_apply.py` and
`test_authoring.py` already recorded): the brief's E2E rows (add-then-
browse, edit description, delete blocked by a SHACL-required relation) ask
for a business-analyst-driven browser flow, but no instances UI exists yet
(that's CE-TASK-006). This codebase's established "no UI yet" stand-in is a
chained API-level flow through the real FastAPI app against real
docker-compose services -- not a mocked-network Playwright spec. The three
`test_e2e_*` functions below are that stand-in; replace with a
browser-driven Playwright spec once TASK-006 ships the instances UI.
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


async def _make_workspace(tenant_id: str, *, label: str) -> Workspace:
    async with tenant_connection(tenant_id) as conn:
        return await create_workspace(conn, tenant_id=tenant_id, slug=label, display_name=label)


async def _add_member(tenant_id: str, workspace_id: str, *, user_sub: str, role: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email=f"{user_sub}@example.invalid",
            role=role,
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
    client: AsyncClient, label: str, *, role: str = "author"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label=label)
    await _add_member(tenant_id, workspace.id, user_sub="u-author", role=role)
    headers = await _authed_headers(
        client, tenant_id=tenant_id, user_sub="u-author", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


async def _add_process_with_actor(
    client: AsyncClient, headers: dict[str, str], *, process_label: str
) -> tuple[str, str]:
    """Fixture pair that satisfies `ProcessShape`'s `performedBy` minCount
    (same fixture shape `test_authoring.py`'s NL happy path already uses).
    Returns (process_iri, actor_iri).
    """
    actor_response = await client.post(
        "/api/instances",
        json={"kind": "Actor", "label": f"Team for {process_label}"},
        headers=headers,
    )
    assert actor_response.status_code == 201
    actor_iri = actor_response.json()["iri"]

    process_response = await client.post(
        "/api/instances",
        json={
            "kind": "Process",
            "label": process_label,
            "relationships": {"performedBy": actor_iri},
        },
        headers=headers,
    )
    assert process_response.status_code == 201
    return process_response.json()["iri"], actor_iri


async def test_add_instance_returns_committed_iri(client: AsyncClient) -> None:
    """AC-005-01."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "add-happy")
    try:
        response = await client.post(
            "/api/instances", json={"kind": "Actor", "label": "Jess"}, headers=headers
        )
        assert response.status_code == 201
        body = response.json()
        assert body["iri"].startswith("https://weave.io/instances/actor-")
        assert body["version_iri"]
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_add_instance_rejects_a_kind_outside_bpmo_before_dispatch(
    client: AsyncClient,
) -> None:
    """AC-005-02."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "add-bad-kind")
    try:
        response = await client.post(
            "/api/instances", json={"kind": "NotARealKind", "label": "x"}, headers=headers
        )
        assert response.status_code == 400
        assert response.json()["detail"]["error"] == "invalid_bpmo_kind"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_add_instance_shacl_violation_returns_422_with_human_field_name(
    client: AsyncClient,
) -> None:
    """AC-005-03: a Process with no `performedBy` Actor trips
    `ProcessShape`'s violation -- 422, human field name, no commit.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "add-violation")
    try:
        response = await client.post(
            "/api/instances", json={"kind": "Process", "label": "Orphan Process"}, headers=headers
        )
        assert response.status_code == 422
        [violation] = response.json()["violations"]
        assert violation["field"] == "Performed by"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_add_instance_duplicate_label_and_kind_returns_existing_iri(
    client: AsyncClient,
) -> None:
    """AC-005-04: HITL -- surfaces the existing IRI instead of silently
    merging into it.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "add-dup")
    try:
        first = await client.post(
            "/api/instances", json={"kind": "Actor", "label": "Jess"}, headers=headers
        )
        assert first.status_code == 201
        existing_iri = first.json()["iri"]

        second = await client.post(
            "/api/instances", json={"kind": "Actor", "label": "jess"}, headers=headers
        )
        assert second.status_code == 409
        assert second.json()["existing_iri"] == existing_iri
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_update_instance_preserves_untouched_properties(client: AsyncClient) -> None:
    """AC-005-06: partial-update only changes the named property."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "update-partial")
    try:
        created = await client.post(
            "/api/instances",
            json={"kind": "Concept", "label": "Widget", "properties": {"colour": "blue"}},
            headers=headers,
        )
        iri = created.json()["iri"]

        updated = await client.patch(
            f"/api/instances/{iri}", json={"properties": {"colour": "red"}}, headers=headers
        )
        assert updated.status_code == 200

        resource = await client.get(
            f"/api/ontology/resource/{iri}",
            params={"version": updated.json()["version_iri"]},
            headers=headers,
        )
        assert resource.status_code == 200
        triples = {t["predicate"]: t["object"] for t in resource.json()["triples"]}
        assert triples["https://weave.io/ontology/colour"] == "red"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_edit_form_prepopulates_from_ce_read_1_resource_endpoint(
    client: AsyncClient,
) -> None:
    """AC-005-09: no new endpoint needed -- the existing `GET
    /api/ontology/resource/{iri}` (CE-READ-1) already returns the draft
    version's current triples, passing the just-minted `version_iri`
    through explicitly (there is no "draft" alias on the read side).
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "edit-prepop")
    try:
        created = await client.post(
            "/api/instances",
            json={"kind": "Concept", "label": "Widget", "properties": {"colour": "blue"}},
            headers=headers,
        )
        iri = created.json()["iri"]
        version_iri = created.json()["version_iri"]

        resource = await client.get(
            f"/api/ontology/resource/{iri}", params={"version": version_iri}, headers=headers
        )
        assert resource.status_code == 200
        assert resource.json()["label"] == "Widget"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_delete_preview_lists_dependent_edges_without_mutating(
    client: AsyncClient,
) -> None:
    """AC-005-07: no `?confirm=true` -> preview only, nothing deleted."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "delete-preview")
    try:
        _process_iri, actor_iri = await _add_process_with_actor(
            client, headers, process_label="Onboarding"
        )

        preview = await client.delete(f"/api/instances/{actor_iri}", headers=headers)
        assert preview.status_code == 200
        body = preview.json()
        assert body["requires_confirmation"] is True
        assert body["incoming"][0]["predicate"] == "https://weave.io/ontology/performedBy"

        # Calling the preview again (still no ?confirm=true) must see the
        # exact same dependent edge -- proof nothing was mutated by the
        # first preview call.
        second_preview = await client.delete(f"/api/instances/{actor_iri}", headers=headers)
        assert second_preview.json()["incoming"] == body["incoming"]
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_delete_confirmed_with_dangling_required_relationship_returns_422(
    client: AsyncClient,
) -> None:
    """AC-005-08: deleting the Actor a Process's `performedBy` requires
    leaves that Process's shape violated -- 422, not committed.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "delete-dangling")
    try:
        _process_iri, actor_iri = await _add_process_with_actor(
            client, headers, process_label="Onboarding"
        )

        response = await client.delete(
            f"/api/instances/{actor_iri}", params={"confirm": "true"}, headers=headers
        )
        assert response.status_code == 422
        [violation] = response.json()["violations"]
        assert violation["field"] == "Performed by"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_delete_confirmed_of_an_unreferenced_node_succeeds(client: AsyncClient) -> None:
    """AC-005-07: confirmed delete of a node nobody depends on commits."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "delete-clean")
    try:
        created = await client.post(
            "/api/instances", json={"kind": "Concept", "label": "Orphan"}, headers=headers
        )
        iri = created.json()["iri"]

        response = await client.delete(
            f"/api/instances/{iri}", params={"confirm": "true"}, headers=headers
        )
        assert response.status_code == 200
        assert response.json()["applied_count"] == 1
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_delete_preview_flags_a_node_visible_in_a_published_version(
    client: AsyncClient,
) -> None:
    """AC-005-10: deleting an entity already referenced by a published
    version must warn, not silently delete draft-only data.
    """
    _tenant_id, workspace, headers = await _authored_workspace(
        client, "delete-published", role="admin"
    )
    try:
        created = await client.post(
            "/api/instances",
            json={"kind": "Concept", "label": "Published Concept"},
            headers=headers,
        )
        version_iri = created.json()["version_iri"]
        iri = created.json()["iri"]

        publish_response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert publish_response.status_code == 200

        preview = await client.delete(f"/api/instances/{iri}", headers=headers)
        assert preview.status_code == 200
        assert preview.json()["published"] is True
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_browse_filters_by_kind_and_keyword_together(client: AsyncClient) -> None:
    """AC-005-14: kind + keyword filters AND together."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "browse-and")
    try:
        await client.post(
            "/api/instances",
            json={"kind": "Concept", "label": "Onboarding Widget"},
            headers=headers,
        )
        await client.post(
            "/api/instances", json={"kind": "Actor", "label": "Onboarding Team"}, headers=headers
        )

        response = await client.get(
            "/api/instances", params={"kind": "Concept", "q": "onboarding"}, headers=headers
        )
        assert response.status_code == 200
        results = response.json()["results"]
        assert len(results) == 1
        assert results[0]["kind"] == "Concept"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_browse_keyword_search_is_case_insensitive(client: AsyncClient) -> None:
    """AC-005-12."""
    _tenant_id, workspace, headers = await _authored_workspace(client, "browse-case")
    try:
        await client.post(
            "/api/instances", json={"kind": "Actor", "label": "Jess Rivera"}, headers=headers
        )

        response = await client.get("/api/instances", params={"q": "JESS"}, headers=headers)
        assert response.status_code == 200
        assert len(response.json()["results"]) == 1
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_e2e_add_then_appears_in_browse(client: AsyncClient) -> None:
    """E2E row 1 (add-then-browse) -- API-level stand-in, see module
    docstring.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "e2e-add-browse")
    try:
        created = await client.post(
            "/api/instances",
            json={"kind": "Process", "label": "Customer Onboarding", "properties": {}},
            headers=headers,
        )
        assert created.status_code == 422  # no performedBy yet -- not committed

        _process_iri, _actor_iri = await _add_process_with_actor(
            client, headers, process_label="Customer Onboarding"
        )

        browse = await client.get(
            "/api/instances", params={"kind": "Process", "q": "Customer"}, headers=headers
        )
        assert browse.status_code == 200
        assert any(r["label"] == "Customer Onboarding" for r in browse.json()["results"])
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_e2e_edit_description_is_committed(client: AsyncClient) -> None:
    """E2E row 2 (edit description) -- API-level stand-in, see module
    docstring.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "e2e-edit")
    try:
        created = await client.post(
            "/api/instances",
            json={"kind": "Concept", "label": "Widget", "properties": {"description": "v1"}},
            headers=headers,
        )
        iri = created.json()["iri"]

        edited = await client.patch(
            f"/api/instances/{iri}", json={"properties": {"description": "v2"}}, headers=headers
        )
        assert edited.status_code == 200

        resource = await client.get(
            f"/api/ontology/resource/{iri}",
            params={"version": edited.json()["version_iri"]},
            headers=headers,
        )
        triples = {t["predicate"]: t["object"] for t in resource.json()["triples"]}
        assert triples["https://weave.io/ontology/description"] == "v2"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_e2e_delete_blocked_by_shacl_required_relation(client: AsyncClient) -> None:
    """E2E row 3 (delete blocked) -- API-level stand-in, see module
    docstring.
    """
    _tenant_id, workspace, headers = await _authored_workspace(client, "e2e-delete-blocked")
    try:
        _process_iri, actor_iri = await _add_process_with_actor(
            client, headers, process_label="Onboarding"
        )

        preview = await client.delete(f"/api/instances/{actor_iri}", headers=headers)
        assert preview.json()["incoming"], "preview must list the dependent Process edge"

        confirmed = await client.delete(
            f"/api/instances/{actor_iri}", params={"confirm": "true"}, headers=headers
        )
        assert confirmed.status_code == 422
    finally:
        await clear_graph(workspace.named_graph_iri)
