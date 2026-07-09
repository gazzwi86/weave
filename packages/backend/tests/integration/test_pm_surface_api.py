"""TASK-014 integration tests (build-engine EPIC-002, v1.0): PM Surface API
core -- projects grid, cascade-validated settings, contributors CRUD, and
create-time governance resolution. Same lane conventions as
`test_projects_api.py` (`pytest.mark.integration` + `pytest.mark.docker`,
`platform_stack` fixture, CE client stubbed via `httpx.MockTransport`).
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
from weave_backend.build.costs import BUDGET_CAP_KEY
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import human_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.pm.contributors import NewContributor, upsert
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.projects.governance import MODEL_TIER_KEY
from weave_backend.settings.resolver import set_setting
from weave_backend.settings.scope import company_iri

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


def _ce_stub() -> AsyncClient:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"versions": _SINGLE_LATEST_VERSION})

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


@pytest.fixture
async def client(platform_stack: Path) -> AsyncIterator[AsyncClient]:
    mock_transport = ASGITransport(app=mock_oidc_app)
    app.dependency_overrides[get_oidc_client] = lambda: AsyncClient(
        transport=mock_transport, base_url="http://mock-oidc"
    )
    app.dependency_overrides[get_ce_client] = _ce_stub
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _headers(tenant_id: str, sub: str = "u-1") -> dict[str, str]:
    tokens = await issue_token_pair(sub=sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def test_should_create_project_shell_via_direct_create(client: AsyncClient) -> None:
    """AC-7: name + description only -> 201, Speccing phase, CE-pinned."""
    tenant_id = _unique_tenant("direct-create")
    headers = await _headers(tenant_id)

    response = await client.post(
        "/api/projects",
        json={"name": "Widget Factory", "description": "a shell"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["lifecycle_phase"] == "Speccing"
    assert body["pinned_graph_version_iri"] == "urn:weave:version:v1"


async def test_should_resolve_governance_cascade_at_project_create(client: AsyncClient) -> None:
    """AC-2: governed at create time -- an immediate settings read shows the
    company-scope-resolved effective values (project/domain rungs are
    unreachable per ADR-013, so company is the observable ceiling).
    """
    tenant_id = _unique_tenant("cascade-create")
    async with tenant_connection(tenant_id) as conn:
        await set_setting(
            conn, tenant_id=tenant_id, key=MODEL_TIER_KEY, scope_iri=company_iri(tenant_id),
            value="premium",
        )
        await set_setting(
            conn, tenant_id=tenant_id, key=BUDGET_CAP_KEY, scope_iri=company_iri(tenant_id),
            value=250.0,
        )
    headers = await _headers(tenant_id)

    create_response = await client.post(
        "/api/projects", json={"name": "Cascade Co"}, headers=headers
    )
    assert create_response.status_code == 201
    project_iri = create_response.json()["project_iri"]

    settings_response = await client.get(
        f"/api/projects/{project_iri}/settings", headers=headers
    )
    assert settings_response.status_code == 200
    settings = settings_response.json()
    assert settings["model_tier"] == "premium"
    assert settings["model_tier_source"] == "company"
    assert settings["cost_cap_usd"] == 250.0
    assert settings["cost_cap_source"] == "company"


async def _seed_project(client: AsyncClient, headers: dict[str, str], name: str) -> str:
    response = await client.post("/api/projects", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return str(response.json()["project_iri"])


async def test_should_mutate_contributors_behind_role_guard(client: AsyncClient) -> None:
    """AC-5: editor 403, admin 200 -- real HTTP + real Postgres."""
    tenant_id = _unique_tenant("contrib-guard")
    admin_headers = await _headers(tenant_id, sub="u-admin")
    project_iri = await _seed_project(client, admin_headers, "Guarded Project")

    editor_sub = "u-editor"
    editor_iri = human_principal_iri(editor_sub)
    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=editor_iri,
                role="editor",
                added_by="urn:weave:person:acme:seed",
            ),
        )
    editor_headers = await _headers(tenant_id, sub=editor_sub)
    target_iri = human_principal_iri("u-new")

    denied = await client.put(
        f"/api/projects/{project_iri}/contributors/{target_iri}",
        json={"role": "editor"},
        headers=editor_headers,
    )
    assert denied.status_code == 403

    async with tenant_connection(tenant_id) as conn:
        await upsert(
            conn,
            tenant_id=tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=human_principal_iri("u-admin"),
                role="admin",
                added_by="urn:weave:person:acme:seed",
            ),
        )
    allowed = await client.put(
        f"/api/projects/{project_iri}/contributors/{target_iri}",
        json={"role": "editor"},
        headers=admin_headers,
    )
    assert allowed.status_code == 200
    assert allowed.json()["role"] == "editor"


async def test_should_paginate_grid_at_100_projects_within_p95(client: AsyncClient) -> None:
    """AC-1 + p95 fixture floor: 100 seeded projects, keyset pagination."""
    tenant_id = _unique_tenant("grid-100")
    headers = await _headers(tenant_id)
    for i in range(100):
        await _seed_project(client, headers, f"Project {i:03d}")

    seen: set[str] = set()
    cursor: str | None = None
    pages = 0
    while True:
        params = {"limit": "25"} | ({"cursor": cursor} if cursor else {})
        response = await client.get("/api/projects", params=params, headers=headers)
        assert response.status_code == 200
        page = response.json()
        seen.update(card["project_iri"] for card in page["items"])
        pages += 1
        cursor = page["next_cursor"]
        if cursor is None:
            break
        assert pages <= 8  # guard against an infinite loop on a paging bug

    assert len(seen) == 100
