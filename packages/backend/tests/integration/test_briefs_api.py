"""BE-TASK-002 integration tests (build-engine EPIC-005): persistence, RLS,
and the CE-READ-1 grounding call, against the real docker-marked stack
(postgres + in-process mock-oidc) -- same lane conventions as
`test_projects_api.py` (BE-TASK-001).

The Architect agent's drafting/validation LLM calls (`draft_brief_document`)
are patched at the module boundary, not stubbed via HTTP transport --
`ai.router.route()` talks to the Anthropic/Bedrock SDK directly, not to an
in-process engine, so there is no ASGI app to swap in the way CE-READ-1's
`get_ce_read_client` dependency is overridden (Law F: no live LLM calls).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.briefs.ce_read_client import get_ce_read_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _unique_project_iri(label: str) -> str:
    return f"urn:weave:project:{label}-{uuid.uuid4().hex[:8]}:acme"


def _ce_stub(context: dict[str, object]) -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=context)

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _raw_brief(task_description: str, project_iri: str) -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "task_id": "placeholder",
        "project_iri": project_iri,
        "title": task_description,
        "user_story": "As a user I want the thing so that value",
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "WHEN X THE SYSTEM SHALL Y", "test_mapping": "test_x"}
        ],
        "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_x"}],
        "dor_checklist": ["User story clear"],
        "dod_checklist": ["All AC met"],
        "dep_chain": {"blocked_by": [], "unlocks": []},
        "cost_estimate": {
            "complexity": "S",
            "estimated_tokens_input_k": 1,
            "estimated_tokens_output_k": 1,
            "estimated_cost_usd": 0.1,
        },
        "generated_at": "2026-07-04T00:00:00Z",
    }


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub({"nodes": []})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_create_and_get_task_brief_round_trip(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = f"tenant-brief-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    with patch(
        "weave_backend.routers.briefs.draft_brief_document",
        return_value=_raw_brief("Do the thing", project_iri),
    ):
        create_response = await client.post(
            f"/api/projects/{project_iri}/briefs",
            json={"task_description": "Do the thing"},
            headers=headers,
        )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["brief_iri"].startswith("urn:weave:brief:")

    get_response = await client.get(
        f"/api/projects/{project_iri}/briefs/{created['task_id']}", headers=headers
    )
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["brief_iri"] == created["brief_iri"]
    assert fetched["content"]["title"] == "Do the thing"


async def test_get_task_brief_returns_stored_document(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = f"tenant-brief-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    with patch(
        "weave_backend.routers.briefs.draft_brief_document",
        return_value=_raw_brief("Ship it", project_iri),
    ):
        create_response = await client.post(
            f"/api/projects/{project_iri}/briefs",
            json={"task_description": "Ship it"},
            headers=headers,
        )
    task_id = create_response.json()["task_id"]

    get_response = await client.get(
        f"/api/projects/{project_iri}/briefs/{task_id}", headers=headers
    )

    assert get_response.status_code == 200
    body = get_response.json()
    assert body["schema_version"] == "1.0"
    assert body["task_id"] == task_id


async def test_brief_store_rls_tenant_isolation(client: AsyncClient, platform_stack: Path) -> None:
    tenant_a = f"tenant-brief-a-{uuid.uuid4().hex[:8]}"
    tenant_b = f"tenant-brief-b-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")

    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    with patch(
        "weave_backend.routers.briefs.draft_brief_document",
        return_value=_raw_brief("Tenant A task", project_iri),
    ):
        create_response = await client.post(
            f"/api/projects/{project_iri}/briefs",
            json={"task_description": "Tenant A task"},
            headers={"Authorization": f"Bearer {tokens_a.access_token}"},
        )
    assert create_response.status_code == 201
    task_id = create_response.json()["task_id"]

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT task_id FROM task_briefs")
    assert rows == []

    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    read_response = await client.get(
        f"/api/projects/{project_iri}/briefs/{task_id}",
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert read_response.status_code == 404


async def test_create_brief_rejects_empty_task_description(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = f"tenant-brief-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        f"/api/projects/{project_iri}/briefs",
        json={"task_description": ""},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {"error": "validation_error", "field": "task_description"}


async def test_create_brief_returns_503_when_ce_read_unavailable(
    client: AsyncClient, platform_stack: Path
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    app.dependency_overrides[get_ce_read_client] = lambda: AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://ce"
    )
    tenant_id = f"tenant-brief-{uuid.uuid4().hex[:8]}"
    project_iri = _unique_project_iri("proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        f"/api/projects/{project_iri}/briefs",
        json={"task_description": "Do the thing"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {"error": "ce_read_unavailable"}
