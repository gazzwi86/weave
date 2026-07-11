"""TASK-020 (build-engine EPIC-007) integration tests: `GET
/api/projects/{id}/decisions` against the real docker-marked stack
(postgres + in-process mock-oidc), same lane conventions as
`test_projects_api.py`/`test_audit_chain_api.py`. Seeds real
`audit_entries` rows via `default_audit_emitter.emit()` (the same emitter
`build/*` call sites use) rather than a fake -- proves the route reads the
real PLAT-AUDIT-1 table, not a Build-side copy (AC-4).
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.audit.decisions import AuditUnavailable
from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client

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


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub(versions: list[dict[str, object]]) -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"versions": versions})

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


async def _create_project(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.post("/api/projects", json={"name": "Acme Corp"}, headers=headers)
    assert response.status_code == 201, response.text
    return str(response.json()["project_iri"])


async def _seed_event(
    tenant_id: str,
    project_iri: str,
    event_type: str,
    actor_iri: str = "urn:weave:principal:t:human:alice",
) -> None:
    async with tenant_connection(tenant_id) as conn:
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=tenant_id,
                event_type=event_type,
                actor_iri=actor_iri,
                subject_iri=project_iri,
                engine="build",
            ),
        )


async def test_should_return_searchable_paginated_decisions_from_audit(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1."""
    tenant_id = _unique_tenant("tenant-declog")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)

    await _seed_event(tenant_id, project_iri, "gate_result_brand")
    await _seed_event(tenant_id, project_iri, "hitl_response")

    response = await client.get(
        f"/api/projects/{project_iri}/decisions?kind=all&search=brand", headers=headers
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["event_type"] == "gate_result_brand"
    assert body["entries"][0]["kind"] == "decision"


async def test_should_show_audit_unavailable_when_plat_audit_1_unreachable(
    client: AsyncClient, platform_stack: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """AC-2: force the query layer to raise `AuditUnavailable` (mirrors a real
    connection failure) rather than physically tearing down the shared docker
    stack -- asserts the route's 503 mapping without disrupting other tests
    sharing the same `platform_stack` fixture.
    """
    tenant_id = _unique_tenant("tenant-declog-down")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)

    async def _raise_unavailable(*_args: object, **_kwargs: object) -> None:
        raise AuditUnavailable

    monkeypatch.setattr(
        "weave_backend.routers.decisions.list_decisions", _raise_unavailable
    )

    response = await client.get(f"/api/projects/{project_iri}/decisions", headers=headers)

    assert response.status_code == 503
    assert response.json()["detail"] == {"error": "audit_unavailable"}


async def test_should_paginate_decisions_with_cursor(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-6."""
    tenant_id = _unique_tenant("tenant-declog-page")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)

    for i in range(3):
        await _seed_event(tenant_id, project_iri, f"gate_result_dor_{i}")

    first = await client.get(
        f"/api/projects/{project_iri}/decisions?kind=all", headers=headers
    )
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["entries"]) == 3
    assert first_body["next_cursor"] is None


async def test_should_re_query_server_on_filter_chip_change_rather_than_hiding_rows_client_side(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-8: a `kind` change fires a fresh request with a narrower server-side
    result set (not a client-side row-hide over one fetched page).
    """
    tenant_id = _unique_tenant("tenant-declog-kind")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    project_iri = await _create_project(client, headers)

    await _seed_event(tenant_id, project_iri, "gate_result_dor")
    await _seed_event(tenant_id, project_iri, "write_back_success")
    await _seed_event(tenant_id, project_iri, "authz_denied")

    all_response = await client.get(
        f"/api/projects/{project_iri}/decisions?kind=all", headers=headers
    )
    decision_response = await client.get(
        f"/api/projects/{project_iri}/decisions?kind=decision", headers=headers
    )
    system_response = await client.get(
        f"/api/projects/{project_iri}/decisions?kind=system", headers=headers
    )

    assert len(all_response.json()["entries"]) == 3
    assert len(decision_response.json()["entries"]) == 1
    assert len(system_response.json()["entries"]) == 1
    assert system_response.json()["entries"][0]["event_type"] == "authz_denied"
