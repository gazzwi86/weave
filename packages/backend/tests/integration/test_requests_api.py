"""BE-TASK-003 integration tests (build-engine EPIC-001): Request Studio's
`POST /api/requests` + `GET /api/requests/{id}` + `GET /api/requests/{id}/
stream`, against the real docker-marked stack (redis + in-process mock-oidc).
Same lane conventions as `test_projects_api.py` (`pytest.mark.integration`
+ `pytest.mark.docker`, `platform_stack` fixture, CE stubbed via
`httpx.MockTransport` through `app.dependency_overrides`).

The LLM provider is likewise stubbed via `app.dependency_overrides[
get_ai_provider]` -- Law F: never a live Anthropic/Bedrock call in tests.
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
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client
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


class _FakeProvider:
    """Instant, deterministic stand-in for `ModelProvider` -- no network."""

    def complete(self, model_id: str, prompt: str, **kwargs: object) -> str:
        return f"draft for {model_id}"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub(versions: list[dict[str, object]]) -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=versions)

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _ce_unreachable_stub() -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("ce unreachable")

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub(_SINGLE_LATEST_VERSION)
    app.dependency_overrides[get_ai_provider] = lambda: _FakeProvider()
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


async def test_create_request_streams_sections_and_persists_draft(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1/AC-2/AC-3: 202 with a stream_url; the stream replays one SSE
    event per drafted section plus a final `done: true`; the drafted
    content and the pinned CE-VERSION-1 graph context both persist and are
    visible via `GET /api/requests/{id}`.
    """
    tenant_id = _unique_tenant("tenant-req")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    create_response = await client.post(
        "/api/requests",
        json={"prompt": "build a widget tracker", "run_mode": "draft_spec_only"},
        headers=headers,
    )
    assert create_response.status_code == 202
    created = create_response.json()
    assert created["status"] == "drafting"
    assert created["stream_url"] == f"/api/requests/{created['request_id']}/stream"

    async with client.stream("GET", created["stream_url"], headers=headers) as stream_response:
        assert stream_response.status_code == 200
        body = await stream_response.aread()

    events = _parse_sse_events(body.decode())
    assert [e["section"] for e in events if not e.get("done")] == ["brief", "prd", "tech_spec"]
    assert events[-1] == {"done": True}

    get_response = await client.get(f"/api/requests/{created['request_id']}", headers=headers)
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["status"] == "draft_complete"
    assert fetched["graph_context"] == "urn:weave:version:v1"
    assert set(fetched["draft_content"]) == {"brief", "prd", "tech_spec"}


async def test_create_request_returns_401_without_jwt(client: AsyncClient) -> None:
    """AC-5: exact body + `Www-Authenticate` header, not just the status
    code -- the shared auth dependency's platform-wide 401 contract.
    """
    response = await client.post(
        "/api/requests", json={"prompt": "build a widget", "run_mode": "draft_spec_only"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": {"error": "unauthorised"}}
    assert response.headers["www-authenticate"] == "Bearer"


async def test_request_degrades_gracefully_when_ce_unreachable(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-7: CE-READ-1 unreachable -> the draft still completes, but
    `graph_context` reads "unavailable" once fetched via GET.
    """
    app.dependency_overrides[get_ce_client] = _ce_unreachable_stub

    tenant_id = _unique_tenant("tenant-req-ce-down")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    create_response = await client.post(
        "/api/requests",
        json={"prompt": "build a widget", "run_mode": "draft_spec_only"},
        headers=headers,
    )
    assert create_response.status_code == 202
    request_id = create_response.json()["request_id"]

    async with client.stream(
        "GET", f"/api/requests/{request_id}/stream", headers=headers
    ) as stream_response:
        await stream_response.aread()

    get_response = await client.get(f"/api/requests/{request_id}", headers=headers)
    assert get_response.json()["graph_context"] == "unavailable"
