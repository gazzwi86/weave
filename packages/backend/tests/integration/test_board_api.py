"""AC-1/AC-3/AC-7 (BE-V1-TASK-017, build-engine EPIC-004): real Postgres
round-trip for `GET /api/projects/{project_iri}/board` and
`GET /api/projects/{project_iri}/task-tree` over a committed state spine,
same docker-marked stack conventions as `test_runs_api.py`. Project-row
seeding is out of scope -- like `get_state_route`, these routes key purely
off `state_spines` (tenant_id, project_iri), no `projects` row join.
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
from weave_backend.build.state_spine import StateSpine, TaskState, commit_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

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


async def _seed_spine(tenant_id: str, project_iri: str) -> None:
    async with tenant_connection(tenant_id) as conn:
        spine = StateSpine(
            project_iri=project_iri,
            tenant_id=tenant_id,
            run_id="run-1",
            phase="halted_hitl",
            dispatch_count=3,
            turn_cap=60,
            tasks=[
                TaskState(id="t-1", status="Done"),
                TaskState(id="t-2", status="Blocked"),
                TaskState(id="t-3", status="Ready", blocked_by=["t-missing"]),
            ],
        )
        await commit_state_spine(conn, spine)


async def test_board_route_groups_tasks_into_six_lanes(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-board")
    project_iri = f"urn:weave:project:{uuid.uuid4().hex[:8]}"
    await _seed_spine(tenant_id, project_iri)

    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    response = await client.get(
        f"/api/projects/{project_iri}/board",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["lanes"] == ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"]
    lanes_by_id = {card["id"]: card["lane"] for card in body["cards"]}
    assert lanes_by_id == {"t-1": "Done", "t-2": "Review", "t-3": "Ready"}


async def test_task_tree_route_flags_missing_dependency(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-tree")
    project_iri = f"urn:weave:project:{uuid.uuid4().hex[:8]}"
    await _seed_spine(tenant_id, project_iri)

    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    response = await client.get(
        f"/api/projects/{project_iri}/task-tree",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 200
    nodes_by_id = {node["id"]: node for node in response.json()["nodes"]}
    assert nodes_by_id["t-missing"]["missing"] is True
    assert nodes_by_id["t-3"]["missing"] is False


async def test_board_route_rls_tenant_b_sees_404(client: AsyncClient, platform_stack: Path) -> None:
    tenant_a = _unique_tenant("tenant-board-a")
    tenant_b = _unique_tenant("tenant-board-b")
    project_iri = f"urn:weave:project:{uuid.uuid4().hex[:8]}"
    await _seed_spine(tenant_a, project_iri)

    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    response = await client.get(
        f"/api/projects/{project_iri}/board",
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert response.status_code == 404
