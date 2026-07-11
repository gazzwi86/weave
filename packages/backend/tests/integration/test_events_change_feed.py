"""CE-V1-TASK-008 integration tests: CE-EVENT-1 change-feed against a real
Postgres + Oxigraph + Redis stack -- same-txn write hook (AC-008-01),
own-txn constraint-violated write (AC-008-02), rollback-leaves-no-orphan
(DoD forced-failure row), the `GET /api/events` read surface with two-tenant
RLS (AC-008-04/-07), and the append-only grant (AC-008-06). Real
same-txn/rollback/RLS/pagination behaviour lives here rather than in the
mocked-boundary unit suite (`test_operations_events.py`,
`test_operations_pipeline_events.py`).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, patch

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.operations import pipeline
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
        return await create_workspace(
            conn, tenant_id=tenant_id, slug=label, display_name=label
        )


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
    client: AsyncClient, *, label: str, role: str = "author"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="events")
    await _add_member(
        tenant_id, workspace.id, user_sub="u-1", role=role, email="u-1@example.invalid"
    )
    headers = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace.id
    )
    return tenant_id, workspace, headers


def _valid_operations() -> list[dict[str, object]]:
    return [
        {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
        {"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"},
        {"op": "add_edge", "subject_ref": "p1", "predicate": "performedBy", "object_ref": "a1"},
    ]


def _violating_operations() -> list[dict[str, object]]:
    # A Process with no `performedBy` -- trips ProcessShape's Violation
    # (same fixture as test_operations_apply.py's SHACL-violation test).
    return [{"op": "add_node", "ref": "p1", "kind": "Process", "label": "Invoicing"}]


async def _fetch_events(tenant_id: str) -> list[asyncpg.Record]:
    async with tenant_connection(tenant_id) as conn:
        rows: list[asyncpg.Record] = await conn.fetch(
            "SELECT seq, change_type, entity_iri, version_iri, last_published_version, actor"
            " FROM graph_change_events WHERE tenant_id = $1 ORDER BY seq ASC",
            tenant_id,
        )
        return rows


async def test_valid_mutation_writes_exactly_one_added_event_in_the_commit_transaction(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-008-01: commit and event are atomic -- a committed mutation leaves
    exactly one row, with the draft-commit shape (null version_iri/
    last_published_version, AC-008-03).
    """
    tenant_id, workspace, headers = await _setup_member(client, label="events-commit")

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201
        # entity_iri is keyed off the batch's *first* op (module docstring's
        # "one commit -> one event" design) -- the minted IRI for ref "a1".
        expected_entity_iri = response.json()["ref_map"]["a1"]

        events = await _fetch_events(tenant_id)
        assert len(events) == 1
        assert events[0]["change_type"] == "added"
        assert events[0]["entity_iri"] == expected_entity_iri
        assert events[0]["version_iri"] is None
        assert events[0]["last_published_version"] is None
        assert events[0]["actor"] == "urn:weave:principal:test-actor"
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_shacl_violation_writes_zero_graph_changes_but_one_constraint_violated_event(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-008-02: a rejected mutation writes no graph data, but records a
    `constraint-violated` event in its own transaction (ADR-008's one
    exception to same-txn).
    """
    tenant_id, workspace, headers = await _setup_member(client, label="events-violate")

    try:
        pre_state = await fetch_graph_turtle(workspace.named_graph_iri)

        response = await client.post(
            "/api/operations/apply",
            json={"operations": _violating_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 422

        post_state = await fetch_graph_turtle(workspace.named_graph_iri)
        assert post_state == pre_state

        events = await _fetch_events(tenant_id)
        assert len(events) == 1
        assert events[0]["change_type"] == "constraint-violated"
        # Attempted target from the rejected op batch -- there's no committed
        # entity to derive from (implementation hint's "pitfall" note), but
        # it must still be a real, non-empty IRI-shaped value.
        assert events[0]["entity_iri"]
        assert events[0]["version_iri"] is None
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_forced_commit_failure_rolls_back_leaving_no_orphan_event(
    client: AsyncClient, platform_stack: Path
) -> None:
    """DoD "same-txn atomicity" row: a failure inside `_commit` (after
    SHACL passes, before promotion) rolls back the whole transaction --
    the event insert shares that transaction, so it must never survive
    either. AC-008-01/02.
    """
    tenant_id, workspace, headers = await _setup_member(client, label="events-rollback")

    try:
        # httpx's ASGITransport re-raises unhandled app exceptions by
        # default (`raise_app_exceptions=True`) rather than surfacing them
        # as a 500 response -- same shape as the equivalent unit rollback
        # tests (`test_operations_pipeline_rollback.py`).
        with (
            patch.object(
                pipeline, "write_activity", AsyncMock(side_effect=RuntimeError("prov store down"))
            ),
            pytest.raises(RuntimeError, match="prov store down"),
        ):
            await client.post(
                "/api/operations/apply",
                json={
                    "operations": _valid_operations(),
                    "actor": "urn:weave:principal:test-actor",
                },
                headers=headers,
            )

        post_state = await fetch_graph_turtle(workspace.named_graph_iri)
        assert post_state == ""

        events = await _fetch_events(tenant_id)
        assert events == []
    finally:
        await clear_graph(workspace.named_graph_iri)


async def test_get_events_returns_ordered_page_hiding_other_tenants_rows(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-008-04/-07: paginated, ordered, `latest_seq` included; tenant B's
    commits never leak into tenant A's page (RLS, `ontology_versions`
    precedent).
    """
    _tenant_a, workspace_a, headers_a = await _setup_member(client, label="events-a")
    _tenant_b, workspace_b, headers_b = await _setup_member(client, label="events-b")

    try:
        a_entity_iris = []
        for ref in ("a1", "a2"):
            resp = await client.post(
                "/api/operations/apply",
                json={
                    "operations": [
                        {"op": "add_node", "ref": ref, "kind": "Actor", "label": ref}
                    ],
                    "actor": "urn:weave:principal:test-actor",
                },
                headers=headers_a,
            )
            assert resp.status_code == 201
            a_entity_iris.append(resp.json()["ref_map"][ref])

        b_resp = await client.post(
            "/api/operations/apply",
            json={
                "operations": [
                    {"op": "add_node", "ref": "b1", "kind": "Actor", "label": "b1"}
                ],
                "actor": "urn:weave:principal:test-actor",
            },
            headers=headers_b,
        )
        assert b_resp.status_code == 201
        b_entity_iri = b_resp.json()["ref_map"]["b1"]

        page = await client.get("/api/events?since_seq=0&limit=50", headers=headers_a)
        assert page.status_code == 200
        body = page.json()
        assert [e["entity_iri"] for e in body["events"]] == a_entity_iris
        assert b_entity_iri not in [e["entity_iri"] for e in body["events"]]
        assert body["latest_seq"] == body["events"][-1]["seq"]
        assert all(e["seq"] <= body["latest_seq"] for e in body["events"])

        # Second page, since_seq set to the first event's seq -- only the
        # second event comes back (AC-008-04's "seq > n" ordering).
        first_seq = body["events"][0]["seq"]
        second_page = await client.get(
            f"/api/events?since_seq={first_seq}&limit=50", headers=headers_a
        )
        assert [e["entity_iri"] for e in second_page.json()["events"]] == [a_entity_iris[1]]
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)


async def test_weave_app_role_cannot_update_or_delete_change_events(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-008-06: append-only like PLAT-AUDIT-1 -- `weave_app` has no
    UPDATE/DELETE grant on `graph_change_events`.
    """
    tenant_id, workspace, headers = await _setup_member(client, label="events-grant")

    try:
        response = await client.post(
            "/api/operations/apply",
            json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
            headers=headers,
        )
        assert response.status_code == 201

        # Separate transactions per statement -- a privilege error aborts
        # the transaction, so a second statement on the same connection
        # would raise "current transaction is aborted" instead of the
        # grant error it's actually checking for (same reason
        # `test_audit_chain_api.py`'s equivalent test isolates each check).
        async with tenant_connection(tenant_id) as conn:
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.execute(
                    "UPDATE graph_change_events SET change_type = 'deleted'"
                    " WHERE tenant_id = $1",
                    tenant_id,
                )
        async with tenant_connection(tenant_id) as conn:
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.execute(
                    "DELETE FROM graph_change_events WHERE tenant_id = $1", tenant_id
                )
    finally:
        await clear_graph(workspace.named_graph_iri)
