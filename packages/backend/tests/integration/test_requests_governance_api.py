"""BE-TASK-004 integration tests (build-engine EPIC-001): Request Studio's
governance gate -- `GET .../blast-radius`, `POST .../sign-off` -- against the
real docker-marked stack (postgres + redis + oxigraph + in-process
mock-oidc). Same lane conventions as `test_requests_api.py`
(`pytest.mark.integration` + `pytest.mark.docker`, `platform_stack` fixture,
CE stubbed via `httpx.MockTransport`).

The LLM provider is an echo double (not `test_requests_api.py`'s fixed
`"draft for {model_id}"` string) so the drafted content contains real,
matchable `urn:weave:...` entity IRIs for the blast-radius/authority queries
to key off.
"""

from __future__ import annotations

import json
import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.rdf.oxigraph_client import clear_graph, load_graph
from weave_backend.routers.requests import get_ai_provider

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_SINGLE_LATEST_VERSION: list[dict[str, object]] = [
    {
        "version_iri": "urn:weave:version:v1",
        "semver": "1.0.0",
        "published_at": "2026-01-01T00:00:00Z",
        "is_latest": True,
    }
]


class _EchoProvider:
    """Echoes the entity IRI baked into every section prompt back into the
    drafted content, so `extract_entity_iris` has something real to find.
    """

    def __init__(self, entity_iri: str) -> None:
        self._entity_iri = entity_iri

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        del model_id, prompt, kwargs
        return f"This spec touches {self._entity_iri} directly."


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub(versions: list[dict[str, object]]) -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=versions)

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub(_SINGLE_LATEST_VERSION)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _parse_sse_events(raw_body: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for line in raw_body.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[len("data: ") :]))
    return events


async def _create_and_complete_draft(
    client: AsyncClient, *, tenant_id: str, entity_iri: str
) -> str:
    app.dependency_overrides[get_ai_provider] = lambda: _EchoProvider(entity_iri)
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    create_response = await client.post(
        "/api/requests",
        json={"prompt": f"build something about {entity_iri}", "run_mode": "draft_spec_only"},
        headers=headers,
    )
    assert create_response.status_code == 202
    request_id: str = create_response.json()["request_id"]

    async with client.stream(
        "GET", f"/api/requests/{request_id}/stream", headers=headers
    ) as stream_response:
        await stream_response.aread()
    return request_id


async def test_blast_radius_returns_touched_domains_and_services(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1."""
    tenant_id = _unique_tenant("tenant-blast")
    entity_iri = f"urn:weave:entity:svc-{uuid.uuid4().hex[:8]}"
    domain_iri = f"urn:weave:domain:sales-{uuid.uuid4().hex[:8]}"
    service_iri = f"urn:weave:service:billing-{uuid.uuid4().hex[:8]}"
    named_graph = f"urn:weave:test-graph:{uuid.uuid4().hex[:8]}"

    await load_graph(
        named_graph,
        f"<{entity_iri}> <urn:weave:bpmo:touchesDomain> <{domain_iri}> .\n"
        f"<{entity_iri}> <urn:weave:bpmo:touchesService> <{service_iri}> .\n",
    )
    try:
        request_id = await _create_and_complete_draft(
            client, tenant_id=tenant_id, entity_iri=entity_iri
        )
        tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
        headers = {"Authorization": f"Bearer {tokens.access_token}"}

        response = await client.get(
            f"/api/requests/{request_id}/blast-radius", headers=headers
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "computed"
        assert body["domains"] == [domain_iri]
        assert body["services"] == [service_iri]
        assert body["entity_count"] == 1
    finally:
        await clear_graph(named_graph)


async def test_sign_off_all_approved_creates_project(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-5: an actual `GET /api/projects/{project_iri}` after sign-off
    proves the project record really exists (Law B: backend-state
    assertion, not just a 200 response).
    """
    tenant_id = _unique_tenant("tenant-signoff")
    entity_iri = f"urn:weave:entity:svc-{uuid.uuid4().hex[:8]}"
    stakeholder_iri = human_principal_iri("u-2")
    named_graph = f"urn:weave:test-graph:{uuid.uuid4().hex[:8]}"

    await load_graph(
        named_graph, f"<{stakeholder_iri}> <urn:weave:bpmo:hasAuthority> <{entity_iri}> .\n"
    )
    try:
        request_id = await _create_and_complete_draft(
            client, tenant_id=tenant_id, entity_iri=entity_iri
        )
        approver_tokens = await issue_token_pair(sub="u-2", tenant_id=tenant_id)
        approver_headers = {"Authorization": f"Bearer {approver_tokens.access_token}"}

        response = await client.post(
            f"/api/requests/{request_id}/sign-off",
            json={"action": "approve"},
            headers=approver_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "approved"
        project_iri = body["project_iri"]
        assert project_iri

        project_response = await client.get(
            f"/api/projects/{project_iri}", headers=approver_headers
        )
        assert project_response.status_code == 200
        assert project_response.json()["project_iri"] == project_iri
    finally:
        await clear_graph(named_graph)


async def test_sign_off_pending_approvals_when_not_all_approved(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-pending")
    entity_iri = f"urn:weave:entity:svc-{uuid.uuid4().hex[:8]}"
    stakeholder_2_iri = human_principal_iri("u-2")
    stakeholder_3_iri = human_principal_iri("u-3")
    named_graph = f"urn:weave:test-graph:{uuid.uuid4().hex[:8]}"

    await load_graph(
        named_graph,
        f"<{stakeholder_2_iri}> <urn:weave:bpmo:hasAuthority> <{entity_iri}> .\n"
        f"<{stakeholder_3_iri}> <urn:weave:bpmo:hasAuthority> <{entity_iri}> .\n",
    )
    try:
        request_id = await _create_and_complete_draft(
            client, tenant_id=tenant_id, entity_iri=entity_iri
        )
        approver_tokens = await issue_token_pair(sub="u-2", tenant_id=tenant_id)
        approver_headers = {"Authorization": f"Bearer {approver_tokens.access_token}"}

        first_response = await client.post(
            f"/api/requests/{request_id}/sign-off",
            json={"action": "approve"},
            headers=approver_headers,
        )
        assert first_response.status_code == 200
        first_body = first_response.json()
        assert first_body["status"] == "pending_approvals"
        assert first_body["remaining"] == [stakeholder_3_iri]

        # Idempotent double-submit (implementation hint): re-approving as
        # the same already-approved stakeholder doesn't change the outcome.
        second_response = await client.post(
            f"/api/requests/{request_id}/sign-off",
            json={"action": "approve"},
            headers=approver_headers,
        )
        assert second_response.status_code == 200
        assert second_response.json() == first_body
    finally:
        await clear_graph(named_graph)
