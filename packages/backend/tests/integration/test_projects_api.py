"""BE-TASK-001 integration tests (build-engine EPIC-002): persistence, RLS,
and the CE-VERSION-1 pin, against the real docker-marked stack (postgres +
in-process mock-oidc). Same lane conventions as `test_tenancy_isolation.py`
(`pytest.mark.integration` + `pytest.mark.docker`, `platform_stack` fixture).

CE-VERSION-1's real endpoint doesn't exist on `main` yet (a separate lane
owns it) -- the CE call is stubbed at the transport boundary via
`httpx.MockTransport` and wired in through `app.dependency_overrides`, the
same mechanism the OIDC client already uses for its mock issuer. Real
cross-engine wiring gets proven once that lane's endpoint merges.
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


async def test_create_project_persists_and_returned_via_get(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-proj")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    create_response = await client.post(
        "/api/projects", json={"name": "Acme Corp"}, headers=headers
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["project_iri"] == f"urn:weave:project:{tenant_id}:acme-corp"
    assert created["pinned_graph_version_iri"] == "urn:weave:version:v1"

    get_response = await client.get(f"/api/projects/{created['project_iri']}", headers=headers)
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["name"] == "Acme Corp"
    assert fetched["pinned_graph_version_iri"] == "urn:weave:version:v1"


async def test_create_project_rejects_unauthenticated_post(client: AsyncClient) -> None:
    response = await client.post("/api/projects", json={"name": "No Auth"})
    assert response.status_code == 401


async def test_project_rls_tenant_b_cannot_read_tenant_a(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_a = _unique_tenant("tenant-proj-a")
    tenant_b = _unique_tenant("tenant-proj-b")

    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    create_response = await client.post(
        "/api/projects",
        json={"name": "Tenant A Project"},
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )
    assert create_response.status_code == 201
    project_iri = create_response.json()["project_iri"]

    # DB-level proof, not just the route's own WHERE clause: a raw,
    # unfiltered SELECT scoped only by tenant B's `app.tenant_id` session
    # setting must never see tenant A's row (same RLS policy shape as
    # test_tenancy_isolation.py's `test_cross_tenant_read_isolation`).
    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT project_iri FROM projects")
    assert rows == []

    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    read_response = await client.get(
        f"/api/projects/{project_iri}",
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert read_response.status_code == 404


async def test_create_project_pins_latest_ce_version_by_flag_not_list_position(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-1: the `is_latest` flag decides the pin, not list order."""
    tenant_id = _unique_tenant("tenant-proj-pin")
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub(
        [
            {
                "version_iri": "urn:weave:version:v1",
                "semver": "1.0.0",
                "published_at": "2026-01-01T00:00:00Z",
                "is_latest": False,
            },
            {
                "version_iri": "urn:weave:version:v2",
                "semver": "1.1.0",
                "published_at": "2026-02-01T00:00:00Z",
                "is_latest": True,
            },
            {
                "version_iri": "urn:weave:version:v0",
                "semver": "0.9.0",
                "published_at": "2025-12-01T00:00:00Z",
                "is_latest": False,
            },
        ]
    )
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        "/api/projects",
        json={"name": "Pin Test"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 201
    assert response.json()["pinned_graph_version_iri"] == "urn:weave:version:v2"


async def test_create_project_persists_source_control_config(
    client: AsyncClient, platform_stack: Path
) -> None:
    """M1 producer for TASK-010: `source_control` is accepted and persisted
    (config only). The response schema never echoes it back (brief's
    contract), so this checks the row directly.
    """
    tenant_id = _unique_tenant("tenant-proj-scm")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        "/api/projects",
        json={
            "name": "SCM Project",
            "source_control": {
                "provider": "github",
                "token_secret_ref": "weave/tenant/scm-project/github-token",
            },
        },
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert response.status_code == 201
    project_iri = response.json()["project_iri"]

    async with tenant_connection(tenant_id) as conn:
        row = await conn.fetchrow(
            "SELECT source_control_provider, source_control_token_secret_ref"
            " FROM projects WHERE project_iri = $1",
            project_iri,
        )
    assert row["source_control_provider"] == "github"
    assert row["source_control_token_secret_ref"] == "weave/tenant/scm-project/github-token"
