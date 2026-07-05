"""CE-TASK-002 integration tests: provenance, the durable audit outbox, and
the version publish/diff endpoints (E9-S1/S2/S3) against a real
Oxigraph + Postgres + Redis stack.

E2E rows (same "no dedicated UI yet" precedent as `test_operations_apply.py`):
publish-then-appears-in-list and diff-between-two-real-mutations are marked
`e2e` -- they drive the real HTTP surface end-to-end rather than unit-mocking
any layer. Replace with browser-driven Playwright specs once a version-
history UI ships.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.audit.emitter import AuditEvent, HashChainAuditEmitter, default_audit_emitter
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.operations import outbox
from weave_backend.operations.provenance import prov_graph_iri
from weave_backend.rdf.oxigraph_client import clear_graph, fetch_graph_turtle
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


async def _setup_member(
    client: AsyncClient, *, label: str, role: str = "author"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="ont")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-1", role=role, email="u-1@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


async def test_no_provenance_activity_recorded_after_a_shacl_violation(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-002-03: `write_activity` only ever runs after SHACL passes -- a
    workspace that only ever attempted a violating mutation has an empty
    provenance graph.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ont-prov-fail")

    response = await client.post(
        "/api/operations/apply",
        json={
            "operations": [{"op": "add_node", "ref": "p1", "kind": "Process", "label": "X"}],
            "actor": "urn:weave:principal:test-actor",
        },
        headers=headers,
    )
    assert response.status_code == 422

    prov_turtle = await fetch_graph_turtle(prov_graph_iri(workspace.named_graph_iri))
    assert prov_turtle == ""


async def test_outbox_survives_a_failing_emitter_and_delivers_on_retry(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-002-04: a down/slow audit sink must never block or roll back the
    mutation that triggered it. Stubs the real emitter to fail exactly once
    (simulating one down flush), confirms the mutation still succeeds and
    the outbox row stays pending, then confirms a later flush delivers it.
    """
    tenant_id, workspace, headers = await _setup_member(client, label="ont-outbox")
    real_emit = HashChainAuditEmitter.emit
    calls = 0

    async def _flaky_emit(conn: object, event: AuditEvent) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("simulated audit sink outage")
        await real_emit(default_audit_emitter, conn, event)  # type: ignore[arg-type]

    monkeypatch.setattr(default_audit_emitter, "emit", _flaky_emit)

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201  # mutation succeeds despite the sink failure

        async with tenant_connection(tenant_id) as conn:
            pending = await conn.fetch(
                "SELECT id FROM audit_outbox WHERE tenant_id = $1 AND delivered_at IS NULL",
                tenant_id,
            )
        assert len(pending) == 1

        async with tenant_connection(tenant_id) as conn:
            delivered = await outbox.flush_pending(conn, tenant_id)
        assert delivered == 1

        async with tenant_connection(tenant_id) as conn:
            rows = await conn.fetch(
                "SELECT event_type FROM audit_entries"
                " WHERE tenant_id = $1 AND event_type = 'operations.applied'",
                tenant_id,
            )
        assert len(rows) == 1
    finally:
        await clear_graph(workspace.named_graph_iri)


@pytest.mark.e2e
async def test_publish_then_appears_in_version_list_as_published(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-002-07/-11, E2E row: apply -> publish -> the version list reflects
    the published status, driven entirely through the real HTTP surface.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ont-publish", role="admin")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert apply_response.status_code == 201
        version_iri = apply_response.json()["version_iri"]

        publish_response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["status"] == "published"
        assert publish_response.json()["published_at"] is not None

        list_response = await client.get(
            "/api/ontology/versions", params={"workspace_id": workspace.id}, headers=headers
        )
        assert list_response.status_code == 200
        versions = list_response.json()["versions"]
        assert versions[0]["version_iri"] == version_iri
        assert versions[0]["status"] == "published"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_republish_returns_405_immutable_message(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-002-09's exact wording."""
    _tenant_id, workspace, headers = await _setup_member(
        client, label="ont-republish", role="admin"
    )

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        version_iri = apply_response.json()["version_iri"]

        first = await client.post(f"/api/ontology/versions/{version_iri}/publish", headers=headers)
        assert first.status_code == 200

        second = await client.post(f"/api/ontology/versions/{version_iri}/publish", headers=headers)
        assert second.status_code == 405
        assert second.json()["detail"]["message"] == "version is published and immutable"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_author_role_cannot_publish_needs_publish_rank(
    client: AsyncClient, platform_stack: Path
) -> None:
    """First real caller of RBAC's `"publish"` tier -- an `author` (rank 1)
    must not be able to publish (rank 2 required).
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ont-publish-rbac")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        version_iri = apply_response.json()["version_iri"]

        response = await client.post(
            f"/api/ontology/versions/{version_iri}/publish", headers=headers
        )
        assert response.status_code == 403
    finally:
        await clear_graph(workspace.named_graph_iri)


@pytest.mark.e2e
async def test_diff_between_two_real_mutations_reflects_the_change(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-002-12/-13, E2E row: two real mutations, then a diff of their
    versions through the real HTTP surface reflects exactly the second
    mutation's additions.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ont-diff")

    try:
        first = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"}
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers,
        )
        assert first.status_code == 201
        from_iri = first.json()["version_iri"]

        second = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert second.status_code == 201
        to_iri = second.json()["version_iri"]

        diff_response = await client.get(
            "/api/ontology/diff", params={"from": from_iri, "to": to_iri}, headers=headers
        )
        assert diff_response.status_code == 200
        body = diff_response.json()
        added_predicates = {t["predicate"] for t in body["added"]}
        assert any("performedBy" in p for p in added_predicates)
        assert body["removed"] == []
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_diff_with_unknown_version_returns_404(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-002-14: either side naming an unknown version is a 404, never a
    diff against a silently-empty graph.
    """
    _tenant_id, workspace, headers = await _setup_member(client, label="ont-diff-404")

    try:
        apply_response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        from_iri = apply_response.json()["version_iri"]
        unknown_to = f"{workspace.named_graph_iri}:v9.9.9"

        response = await client.get(
            "/api/ontology/diff", params={"from": from_iri, "to": unknown_to}, headers=headers
        )
        assert response.status_code == 404
    finally:
        await clear_graph(workspace.named_graph_iri)
