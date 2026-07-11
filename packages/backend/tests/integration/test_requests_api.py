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

import asyncio
import json
import shutil
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.routers.requests import get_ai_provider
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import Workspace, create_workspace

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
        return httpx.Response(200, json={"versions": versions})

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
        json={
            "prompt": "build a widget tracker",
            "run_mode": "draft_spec_only",
            "name": "Widget tracker",
        },
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
    assert response.json() == {"error": "unauthorised"}
    assert response.headers["www-authenticate"] == "Bearer"


async def test_stream_returns_404_for_other_tenants_request(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Fix: cross-tenant IDOR -- tenant B must not be able to open tenant
    A's SSE stream, whether or not tenant A's request_id even exists.
    """
    tenant_a = _unique_tenant("tenant-req-a")
    tenant_b = _unique_tenant("tenant-req-b")
    tokens_a = await issue_token_pair(sub="u-1", tenant_id=tenant_a)
    tokens_b = await issue_token_pair(sub="u-2", tenant_id=tenant_b)
    headers_a = {"Authorization": f"Bearer {tokens_a.access_token}"}
    headers_b = {"Authorization": f"Bearer {tokens_b.access_token}"}

    create_response = await client.post(
        "/api/requests",
        json={
            "prompt": "build a widget tracker",
            "run_mode": "draft_spec_only",
            "name": "Widget tracker",
        },
        headers=headers_a,
    )
    assert create_response.status_code == 202
    request_id = create_response.json()["request_id"]

    async with client.stream(
        "GET", f"/api/requests/{request_id}/stream", headers=headers_a
    ) as own_stream:
        await own_stream.aread()

    async with client.stream(
        "GET", f"/api/requests/{request_id}/stream", headers=headers_b
    ) as cross_tenant_stream:
        body = await cross_tenant_stream.aread()
        assert cross_tenant_stream.status_code == 404

    assert json.loads(body) == {"detail": {"error": "not_found"}}


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
        json={
            "prompt": "build a widget",
            "run_mode": "draft_spec_only",
            "name": "Widget",
        },
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


async def test_create_request_persists_new_fields(client: AsyncClient) -> None:
    """AC-3/AC-7: name/grounding_entity_iris/target_repo_name persist
    end-to-end and are visible on the GET record, without disturbing the
    existing drafting pipeline.
    """
    tenant_id = _unique_tenant("tenant-req-fields")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    create_response = await client.post(
        "/api/requests",
        json={
            "prompt": "build a widget tracker",
            "run_mode": "draft_spec_only",
            "name": "Widget tracker request",
            "grounding_entity_iris": [],
        },
        headers=headers,
    )
    assert create_response.status_code == 202
    request_id = create_response.json()["request_id"]

    get_response = await client.get(f"/api/requests/{request_id}", headers=headers)
    assert get_response.status_code == 200
    body = get_response.json()
    assert body["name"] == "Widget tracker request"
    assert body["grounding_entity_iris"] == []
    assert body["target_repo_name"] is None


async def test_create_request_rejects_unresolvable_grounding_entity(
    client: AsyncClient,
) -> None:
    """AC-6: an IRI that CE-READ-1 (`GET /api/ontology/resource/{iri}`)
    can't resolve fails the request with a 422 -- no partial persist.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if "/api/ontology/resource/" in str(request.url):
            return httpx.Response(404, json={"detail": {"error": "not_found"}})
        return httpx.Response(200, json={"versions": _SINGLE_LATEST_VERSION})

    app.dependency_overrides[get_ce_client] = lambda: AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://ce"
    )
    tenant_id = _unique_tenant("tenant-req-badiri")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(
        "/api/requests",
        json={
            "prompt": "build a widget tracker",
            "run_mode": "draft_spec_only",
            "name": "Widget tracker request",
            "grounding_entity_iris": ["urn:weave:instances:missing-1"],
        },
        headers=headers,
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["error"] == "grounding_entity_not_found"
    assert detail["field"] == "grounding_entity_iris"


async def test_request_record_shows_provenance_links_or_pinned_version_fallback(
    client: AsyncClient,
) -> None:
    """AC-7: a record with grounding entities links each one to
    `/ce/resource/{iri}`; a record with zero grounding entities falls back
    to the pinned `CE-VERSION-1` graph as a `/ce/versions/{iri}` link -- the
    record always carries at least one link.
    """
    tenant_id = _unique_tenant("tenant-req-provenance")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    grounded_iri = "urn:weave:instances:widget-1"
    create_response = await client.post(
        "/api/requests",
        json={
            "prompt": "build a widget tracker",
            "run_mode": "draft_spec_only",
            "name": "Widget tracker request",
            "grounding_entity_iris": [grounded_iri],
        },
        headers=headers,
    )
    assert create_response.status_code == 202
    request_id = create_response.json()["request_id"]

    get_response = await client.get(f"/api/requests/{request_id}", headers=headers)
    body = get_response.json()
    assert body["provenance_links"] == [
        {"iri": grounded_iri, "href": f"/ce/resource/{grounded_iri}"}
    ]

    fallback_response = await client.post(
        "/api/requests",
        json={
            "prompt": "build another widget tracker",
            "run_mode": "draft_spec_only",
            "name": "No entities request",
            "grounding_entity_iris": [],
        },
        headers=headers,
    )
    assert fallback_response.status_code == 202
    fallback_id = fallback_response.json()["request_id"]

    fallback_get = await client.get(f"/api/requests/{fallback_id}", headers=headers)
    fallback_body = fallback_get.json()
    assert len(fallback_body["provenance_links"]) == 1
    pinned = fallback_body["provenance_links"][0]
    assert pinned["href"] == f"/ce/versions/{pinned['iri']}"


async def _setup_typeahead_workspace(client: AsyncClient) -> dict[str, str]:
    """Real workspace + membership + one seeded entity, for AC-2/AC-8's
    typeahead route (the only requests-router surface backed by real
    Oxigraph rather than the stubbed `get_ce_client` override).
    """
    tenant_id = _unique_tenant("tenant-req-typeahead")
    async with tenant_connection(tenant_id) as conn:
        workspace: Workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="typeahead", display_name="typeahead"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="u-1@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="u-1@example.invalid", user_sub="u-1"
        )
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    switch_response = await client.post(
        f"/api/workspaces/{workspace.id}/switch", headers=headers
    )
    assert switch_response.status_code == 200

    apply_response = await client.post(
        "/api/operations/apply",
        json={
            "operations": [
                {"op": "add_node", "ref": "s1", "kind": "Service", "label": "Widget Tracker"},
                {"op": "add_node", "ref": "s2", "kind": "Service", "label": "Widget Reporter"},
                {"op": "add_node", "ref": "a1", "kind": "Actor", "label": "Billing Team"},
            ],
            "actor": "urn:weave:principal:test-actor",
        },
        headers=headers,
    )
    assert apply_response.status_code == 201
    return headers


async def test_grounding_typeahead_returns_matching_entities(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-2: a 2+ char query returns label + kind matches; below the 2-char
    minimum, no CE query is issued and an empty result comes back.
    """
    headers = await _setup_typeahead_workspace(client)

    short_response = await client.get(
        "/api/ontology/entities/typeahead", params={"q": "w"}, headers=headers
    )
    assert short_response.status_code == 200
    assert short_response.json() == {"results": []}

    response = await client.get(
        "/api/ontology/entities/typeahead", params={"q": "widget"}, headers=headers
    )
    assert response.status_code == 200
    results = response.json()["results"]
    labels = {r["label"] for r in results}
    assert labels == {"Widget Tracker", "Widget Reporter"}
    assert all(r["kind"] == "service" for r in results)


async def test_typeahead_p95_under_400ms_10_concurrent(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-8: 10 concurrent typeahead queries against the seeded workspace
    each resolve within a 400ms p95 budget (thin CE-READ-1 pass-through, no
    new store, no caching layer).
    """
    headers = await _setup_typeahead_workspace(client)

    async def _timed_query() -> float:
        start = time.perf_counter()
        response = await client.get(
            "/api/ontology/entities/typeahead", params={"q": "widget"}, headers=headers
        )
        assert response.status_code == 200
        return time.perf_counter() - start

    durations = await asyncio.gather(*(_timed_query() for _ in range(10)))
    durations.sort()
    p95_index = min(len(durations) - 1, int(len(durations) * 0.95))
    assert durations[p95_index] < 0.4
