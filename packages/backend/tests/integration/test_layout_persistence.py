"""TASK-004 integration tests: layout-persistence routes against real
Aurora (docker postgres), proving AC-1/AC-5 (persist+retrieve round-trip)
and AC-7 (RLS enforced at the DB layer, independent of application checks).
Mirrors test_search_tenancy.py's fixture/marker style.
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
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.routers.layout import _layout_connection

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _uuid() -> str:
    """explorer_layout_positions.tenant_id/workspace_id are UUID columns
    (ADR-001-approved, stricter than the platform's TEXT tenant_id) -- test
    tenant/workspace ids must be real UUIDs, not the free-text slugs other
    routers' tests use.
    """
    return str(uuid.uuid4())


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


async def test_persist_position_via_post_and_retrieve_via_get(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _uuid()
    workspace_id = _uuid()
    tokens = await issue_token_pair(sub="u-layout-a", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    save_response = await client.post(
        "/api/layout/positions",
        json={
            "graph_id": "g1",
            "node_iri": "urn:weave:entity:cust-onboarding",
            "position_x": 120.5,
            "position_y": -40.1,
            "workspace_id": workspace_id,
        },
        headers=headers,
    )
    assert save_response.status_code == 204

    get_response = await client.get(
        "/api/layout/positions",
        params={"graph_id": "g1", "workspace_id": workspace_id},
        headers=headers,
    )
    assert get_response.status_code == 200
    positions = get_response.json()["positions"]
    assert len(positions) == 1
    assert positions[0]["node_iri"] == "urn:weave:entity:cust-onboarding"
    assert positions[0]["position_x"] == pytest.approx(120.5, abs=0.5)
    assert positions[0]["position_y"] == pytest.approx(-40.1, abs=0.5)
    assert positions[0]["locked"] is False


async def test_upsert_on_duplicate_drag_updates_not_inserts(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _uuid()
    workspace_id = _uuid()
    tokens = await issue_token_pair(sub="u-layout-b", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    body = {
        "graph_id": "g1",
        "node_iri": "urn:weave:entity:x",
        "position_x": 1.0,
        "position_y": 1.0,
        "workspace_id": workspace_id,
    }

    await client.post("/api/layout/positions", json=body, headers=headers)
    body["position_x"] = 99.0
    await client.post("/api/layout/positions", json=body, headers=headers)

    get_response = await client.get(
        "/api/layout/positions",
        params={"graph_id": "g1", "workspace_id": workspace_id},
        headers=headers,
    )
    positions = get_response.json()["positions"]
    assert len(positions) == 1
    assert positions[0]["position_x"] == pytest.approx(99.0, abs=0.5)


async def test_reset_layout_clears_rows(client: AsyncClient, platform_stack: Path) -> None:
    tenant_id = _uuid()
    workspace_id = _uuid()
    tokens = await issue_token_pair(sub="u-layout-c", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    await client.post(
        "/api/layout/positions",
        json={
            "graph_id": "g1",
            "node_iri": "urn:weave:entity:x",
            "position_x": 1.0,
            "position_y": 1.0,
            "workspace_id": workspace_id,
        },
        headers=headers,
    )

    delete_response = await client.delete(
        "/api/layout/positions",
        params={"graph_id": "g1", "workspace_id": workspace_id},
        headers=headers,
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        "/api/layout/positions",
        params={"graph_id": "g1", "workspace_id": workspace_id},
        headers=headers,
    )
    assert get_response.json() == {"positions": []}


async def test_cross_tenant_layout_isolation_rls(platform_stack: Path) -> None:
    """AC-7: RLS enforced at the DB layer, independent of application-layer
    checks -- proven by a raw query with no tenant_id in its own WHERE
    clause at all, relying solely on the RLS policy set via
    `app.current_tenant_id` to filter tenant-B's row out.
    """
    tenant_a, tenant_b = _uuid(), _uuid()
    workspace_a, workspace_b = _uuid(), _uuid()

    async with _layout_connection(tenant_a) as conn:
        await conn.execute(
            """
            INSERT INTO explorer_layout_positions
                (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y)
            VALUES ($1, $2, 'g1', 'urn:weave:entity:a', 1.0, 1.0)
            """,
            tenant_a,
            workspace_a,
        )
    async with _layout_connection(tenant_b) as conn:
        await conn.execute(
            """
            INSERT INTO explorer_layout_positions
                (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y)
            VALUES ($1, $2, 'g1', 'urn:weave:entity:b', 2.0, 2.0)
            """,
            tenant_b,
            workspace_b,
        )

    async with _layout_connection(tenant_a) as conn:
        rows = await conn.fetch("SELECT tenant_id, node_iri FROM explorer_layout_positions")

    assert len(rows) == 1
    assert rows[0]["node_iri"] == "urn:weave:entity:a"

    # Cleanup: each tenant's own RLS-scoped connection, one query per side --
    # a raw pool connection with no `app.current_tenant_id` set would trip
    # the policy's `current_setting(...)` (no default) rather than silently
    # matching nothing.
    async with _layout_connection(tenant_a) as conn:
        await conn.execute("DELETE FROM explorer_layout_positions WHERE graph_id = 'g1'")
    async with _layout_connection(tenant_b) as conn:
        await conn.execute("DELETE FROM explorer_layout_positions WHERE graph_id = 'g1'")
