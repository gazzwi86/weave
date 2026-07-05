"""BE-TASK-005 integration tests (AC-4, AC-8): HITL approve resumes a task
end-to-end through the real ASGI app + mock-OIDC JWTs, and a FAIL
`TypedResult` persists through `PLAT-AUDIT-1` into the real hash-chained
`audit_entries` table. Marked `integration`/`docker` per
`test_audit_chain_api.py`'s precedent.
"""

from __future__ import annotations

import json
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.build import store
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
    store.reset_for_tests()


async def _create_workspace_via_route(
    client: AsyncClient, *, tenant_id: str, admin_sub: str, slug: str
) -> dict[str, str]:
    tokens = await issue_token_pair(sub=admin_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    response = await client.post(
        f"/api/tenants/{tenant_id}/workspaces",
        json={"slug": slug, "display_name": slug},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return headers


async def test_hitl_approve_resumes_task_via_api(client: AsyncClient) -> None:
    tenant_id = _unique_tenant("tenant-hitl")
    headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="admin-1", slug="ws-1"
    )
    store.create_task(tenant_id, "task-1")
    store.set_last_agent_principal(tenant_id, "task-1", "urn:weave:principal:agent:a1")

    response = await client.post(
        "/api/tasks/task-1/hitl", json={"action": "approve"}, headers=headers
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"action": "resumed"}
    task = store.get_task(tenant_id, "task-1")
    assert task is not None
    assert task.status == "In Progress"


async def test_agent_result_fail_persists_typed_result_via_audit(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-audit")
    headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="agent-1", slug="ws-1"
    )
    store.create_task(tenant_id, "task-2")

    response = await client.post(
        "/api/tasks/task-2/result",
        json={
            "status": "FAIL",
            "failure_class": "logic",
            "evidence": "assertion failed",
            "retry_recommended": True,
        },
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"action": "retry", "retry_count": 1}

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT event_type, diff_summary FROM audit_entries "
            "WHERE tenant_id = $1 AND event_type = 'agent_result'",
            tenant_id,
        )
    assert row is not None
    # diff_summary is JSONB stored via json.dumps and read raw (no jsonb codec on
    # the pool -- the app readers in audit/listing.py + verify.py json.loads it too),
    # so asyncpg hands it back as a str, not a dict. Parse before indexing.
    assert json.loads(row["diff_summary"])["failure_class"] == "logic"
