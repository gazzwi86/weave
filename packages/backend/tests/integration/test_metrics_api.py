"""CE-METRICS-1 (TASK-007) integration tests: `GET /api/metrics/ontology`
against real Oxigraph + Postgres + Redis (docker lane). Helper/fixture
pattern copied from `test_ce_contract_read_endpoints.py` /
`test_ontology_lifecycle.py` -- no shared conftest for these exists yet, so
each integration test file keeps its own copy (repo convention).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.operations import aggregate_metrics
from weave_backend.rdf.oxigraph_client import run_query
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
    client: AsyncClient, *, label: str, role: str = "read"
) -> tuple[str, Workspace, dict[str, str]]:
    tenant_id = _unique_tenant(label)
    workspace = await _make_workspace(tenant_id, label="metrics")
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


async def test_metrics_ontology_401s_with_no_bearer_token(client: AsyncClient) -> None:
    """AC-007-06."""
    response = await client.get("/api/metrics/ontology")
    assert response.status_code == 401


async def test_metrics_ontology_returns_correct_counts_and_delta_on_seeded_fixture(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-007-01/-02/-04: counts grouped by BPMO kind on the seeded fixture
    graph; `draft_published_delta` reuses the M1 diff core against an empty
    "published" side (never-published tenant); `latest_version` is null.
    """
    _tenant_id, _workspace, headers = await _setup_member(
        client, label="metrics-seed", role="author"
    )

    apply_response = await client.post(
        "/api/operations/apply",
        json={"operations": _valid_operations(), "actor": "urn:weave:principal:test-actor"},
        headers=headers,
    )
    assert apply_response.status_code == 201

    response = await client.get("/api/metrics/ontology", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["entity_count_by_kind"]["Actor"] == 1
    assert body["entity_count_by_kind"]["Process"] == 1
    assert body["latest_version"] is None
    assert body["draft_published_delta"]["added"] > 0
    assert body["draft_published_delta"]["removed"] == 0
    assert body["draft_published_delta"]["modified"] == 0
    assert body["shacl_errors_by_severity"] == {"pending": True}
    assert body["owl_inconsistencies"] == {"pending": True}


async def test_metrics_ontology_empty_graph_returns_zeros_not_errors(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-007-06: a tenant with an empty graph gets zeros, not errors."""
    _tenant_id, _workspace, headers = await _setup_member(client, label="metrics-empty")

    response = await client.get("/api/metrics/ontology", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["entity_count_by_kind"]["Actor"] == 0
    assert body["draft_published_delta"] == {"added": 0, "removed": 0, "modified": 0}


async def test_metrics_ontology_second_call_serves_from_cache_within_60s(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-007-05: a second call within the 60s window is served from cache
    -- the underlying SPARQL store is spied on and must be hit exactly once
    across both calls.
    """
    _tenant_id, _workspace, headers = await _setup_member(client, label="metrics-cache")

    calls = 0

    async def _counting_run_query(query: str, named_graph_iri: str) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return await run_query(query, named_graph_iri)

    monkeypatch.setattr(aggregate_metrics, "run_query", _counting_run_query)

    first = await client.get("/api/metrics/ontology", headers=headers)
    second = await client.get("/api/metrics/ontology", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert calls == 1


async def test_metrics_ontology_cache_does_not_leak_across_workspaces_in_same_tenant(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Edge case (QA-added, ADR-022): the cache key is `(tenant_id,
    workspace_id)`, not `tenant_id` alone. Two workspaces in the SAME
    tenant, seeded with different counts, must each see their own numbers
    -- a tenant-only key would let workspace B's first call replay
    workspace A's already-cached response (or vice versa).
    """
    tenant_id = _unique_tenant("metrics-multi-ws")
    workspace_a = await _make_workspace(tenant_id, label="ws-a")
    workspace_b = await _make_workspace(tenant_id, label="ws-b")
    await _add_member(
        tenant_id, workspace_a.id, user_sub="u-1", role="author", email="u-1@example.invalid"
    )
    await _add_member(
        tenant_id, workspace_b.id, user_sub="u-1", role="author", email="u-1@example.invalid"
    )
    headers_a = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace_a.id
    )
    apply_a = await client.post(
        "/api/operations/apply",
        json={
            "operations": [{"op": "add_node", "ref": "a1", "kind": "Actor", "label": "A"}],
            "actor": "urn:weave:principal:test-actor",
        },
        headers=headers_a,
    )
    assert apply_a.status_code == 201

    headers_b = await _authed_client(
        client, tenant_id=tenant_id, user_sub="u-1", workspace_id=workspace_b.id
    )
    apply_b = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {"op": "add_node", "ref": "a2", "kind": "Actor", "label": "B1"},
                {"op": "add_node", "ref": "a3", "kind": "Actor", "label": "B2"},
            ],
            "actor": "urn:weave:principal:test-actor",
        },
        headers=headers_b,
    )
    assert apply_b.status_code == 201

    # Explicit ?workspace_id= (both calls use headers_a -- one principal, two
    # workspaces -- since `_authed_client`'s workspace-switch call mutates
    # server-side active-workspace state per principal; the default-active-
    # workspace path is already covered by the cache test above). Populate
    # the cache for A first, then B -- if the key were tenant-only, B's call
    # below would replay A's already-cached {"Actor": 1}.
    response_a = await client.get(
        "/api/metrics/ontology", headers=headers_a, params={"workspace_id": workspace_a.id}
    )
    response_b = await client.get(
        "/api/metrics/ontology", headers=headers_a, params={"workspace_id": workspace_b.id}
    )

    assert response_a.json()["entity_count_by_kind"]["Actor"] == 1
    assert response_b.json()["entity_count_by_kind"]["Actor"] == 2
