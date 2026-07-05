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

import asyncio
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


# --- QA edge cases (BE-TASK-001) -------------------------------------------


@pytest.mark.xfail(
    strict=True,
    reason=(
        "QA finding (BE-TASK-001): slugify() strips an emoji/punctuation-only "
        "name down to '', which passes the router's `not body.name.strip()` "
        "AC-6 gate but fails the projects table's CHECK(slug <> ''). The "
        "UniqueViolationError handler in projects/model.py does not catch "
        "CheckViolationError, so this reaches the client as an unhandled 500 "
        "instead of AC-6's 422. Remove this xfail once the engineer adds an "
        "empty-slug guard (e.g. reject when `slugify(name) == ''`)."
    ),
)
async def test_create_project_emoji_only_name_returns_422_not_500(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-proj-emoji")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        "/api/projects",
        json={"name": "🎉🎉🎉"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {"error": "validation_error", "field": "name"}


async def test_create_project_true_concurrent_race_second_request_gets_409(
    client: AsyncClient, platform_stack: Path
) -> None:
    """AC-5's pseudocode: two requests race past the pre-check for the same
    (tenant_id, slug); the DB's UNIQUE constraint -- not the pre-check --
    must be what turns the loser into a 409. Unlike
    `test_create_project_route_409_on_race_condition_from_create_project`
    (unit test, mocks `create_project` to *simulate* the race), this drives
    two real concurrent inserts against Postgres.
    """
    tenant_id = _unique_tenant("tenant-proj-race")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    responses = await asyncio.gather(
        client.post("/api/projects", json={"name": "Race Project"}, headers=headers),
        client.post("/api/projects", json={"name": "Race Project"}, headers=headers),
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 409]
    winner = next(r for r in responses if r.status_code == 201).json()
    loser = next(r for r in responses if r.status_code == 409).json()
    assert loser["detail"]["existing_iri"] == winner["project_iri"]


async def test_create_project_duplicate_name_does_not_leak_across_tenants(
    client: AsyncClient, platform_stack: Path
) -> None:
    """The duplicate-name conflict check is scoped by `tenant_id`, so tenant
    B creating the same name as tenant A must succeed (201), not 409 -- a 409
    here would let tenant B infer tenant A's project names exist.
    """
    tenant_a = _unique_tenant("tenant-dup-a")
    tenant_b = _unique_tenant("tenant-dup-b")
    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)

    response_a = await client.post(
        "/api/projects",
        json={"name": "Shared Name"},
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )
    response_b = await client.post(
        "/api/projects",
        json={"name": "Shared Name"},
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )

    assert response_a.status_code == 201
    assert response_b.status_code == 201
    assert response_a.json()["project_iri"] != response_b.json()["project_iri"]


async def test_create_project_returns_503_when_ce_versions_has_no_is_latest_entry(
    client: AsyncClient, platform_stack: Path
) -> None:
    """Pre-first-publish CE graph: `GET /api/ontology/versions` returns a
    non-empty list with no `is_latest: true` entry. Must be the same 503 as
    an unreachable CE, not a 500/crash.
    """
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub(
        [
            {
                "version_iri": "urn:weave:version:v0",
                "semver": "0.9.0",
                "published_at": "2025-01-01T00:00:00Z",
                "is_latest": False,
            }
        ]
    )
    tenant_id = _unique_tenant("tenant-proj-no-latest")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        "/api/projects",
        json={"name": "No Latest Project"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {"error": "ce_version_unavailable"}


async def test_create_project_returns_503_when_ce_versions_list_is_empty(
    client: AsyncClient, platform_stack: Path
) -> None:
    """CE graph has published nothing yet -- an empty list, not just a
    missing `is_latest` flag. Must still be 503, not a crash on `next()`.
    """
    app.dependency_overrides[get_ce_client] = lambda: _ce_stub([])
    tenant_id = _unique_tenant("tenant-proj-empty-versions")
    tokens = await issue_token_pair(sub="u-1", tenant_id=tenant_id)

    response = await client.post(
        "/api/projects",
        json={"name": "Empty Versions Project"},
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {"error": "ce_version_unavailable"}
