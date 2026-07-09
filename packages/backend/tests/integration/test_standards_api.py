"""TASK-001 (build-engine EPIC-002) integration tests against the real
docker-marked stack (postgres + in-process mock-oidc), same lane
conventions as `test_briefs_api.py` / `test_projects_api.py`:

* AC-1: `PUT /api/standards/{scope}/{key}` 422s `policy_not_found` when
  CE-READ-1 (stubbed) resolves the `policy_iri` to a 404.
* AC-2: 503s `ce_unavailable` when CE-READ-1 (stubbed) is unreachable --
  404 and unreachable are never collapsed into the same outcome.
* AC-6: a tenant-B principal reading `/api/standards` sees zero of
  tenant-A's rows (RLS + repo-layer base filter).
* Round-trip proof (AC-3/AC-5): a successful PUT is visible on
  `GET /api/standards/effective`, with `stack_pins` intact.
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
from weave_backend.briefs.ce_read_client import get_ce_read_client
from weave_backend.db.pool import tenant_connection
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.projects.ce_version_client import get_ce_client
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_POLICY_IRI = "urn:weave:policy:t1:secure-coding"


def _unique_tenant(label: str) -> str:
    return f"{label}-{uuid.uuid4().hex[:8]}"


def _ce_stub_ok() -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"iri": _POLICY_IRI, "kind": "Policy"})

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _ce_stub_404() -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "resource_not_found"})

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _ce_stub_down() -> AsyncClient:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("CE-READ-1 is down", request=_request)

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


def _ce_version_stub() -> AsyncClient:
    """CE-VERSION-1 stub for `POST /api/projects` (needed only by the
    round-trip test, which creates a project) -- same shape as
    `test_projects_api.py`'s `_SINGLE_LATEST_VERSION`.
    """

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "versions": [
                    {
                        "version_iri": "urn:weave:version:v1",
                        "semver": "1.0.0",
                        "published_at": "2026-01-01T00:00:00Z",
                        "is_latest": True,
                    }
                ]
            },
        )

    return AsyncClient(transport=httpx.MockTransport(handler), base_url="http://ce")


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


async def _admin_headers(tenant_id: str, *, user_sub: str = "u-admin") -> dict[str, str]:
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="std", display_name="Standards"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email=f"{user_sub}@example.invalid",
            role="admin",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email=f"{user_sub}@example.invalid", user_sub=user_sub
        )
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def _non_admin_headers(tenant_id: str, *, user_sub: str = "u-author") -> dict[str, str]:
    """QA edge case (BE-V1-TASK-001): a tenant member with a real, active,
    but *sub-admin* role -- proves `require_tenant_admin` (ADR-010's
    tenant-admin authz fallback) actually rejects an authenticated
    non-admin, not just an anonymous/missing-membership caller.
    """
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="std-member", display_name="Standards Member"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email=f"{user_sub}@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email=f"{user_sub}@example.invalid", user_sub=user_sub
        )
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    return {"Authorization": f"Bearer {tokens.access_token}"}


async def test_put_standard_422s_policy_not_found_when_ce_404s(client: AsyncClient) -> None:
    tenant_id = _unique_tenant("std-404")
    headers = await _admin_headers(tenant_id)
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_404()

    response = await client.put(
        "/api/standards/company/lint",
        json={"title": "Lint rules", "body_md": "# Lint", "policy_iri": _POLICY_IRI},
        headers=headers,
    )

    assert response.status_code == 422
    assert response.json() == {"detail": {"error": "policy_not_found"}}


async def test_put_standard_503s_ce_unavailable_when_ce_is_down(client: AsyncClient) -> None:
    tenant_id = _unique_tenant("std-down")
    headers = await _admin_headers(tenant_id)
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_down()

    response = await client.put(
        "/api/standards/company/lint",
        json={"title": "Lint rules", "body_md": "# Lint", "policy_iri": _POLICY_IRI},
        headers=headers,
    )

    assert response.status_code == 503
    assert response.json() == {"detail": {"error": "ce_unavailable"}}


async def test_list_standards_returns_zero_tenant_a_rows_under_tenant_b_context(
    client: AsyncClient,
) -> None:
    tenant_a = _unique_tenant("std-iso-a")
    tenant_b = _unique_tenant("std-iso-b")
    headers_a = await _admin_headers(tenant_a, user_sub="u-a")
    headers_b = await _admin_headers(tenant_b, user_sub="u-b")
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_ok()

    put_response = await client.put(
        "/api/standards/company/lint",
        json={
            "title": "Lint rules",
            "body_md": "# Lint",
            "policy_iri": _POLICY_IRI,
            "status": "active",
        },
        headers=headers_a,
    )
    assert put_response.status_code == 200

    list_response = await client.get("/api/standards", headers=headers_b)

    assert list_response.status_code == 200
    assert list_response.json() == {"standards": []}


async def test_put_then_get_effective_round_trip_with_stack_pins(client: AsyncClient) -> None:
    tenant_id = _unique_tenant("std-effective")
    headers = await _admin_headers(tenant_id)
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_ok()
    app.dependency_overrides[get_ce_client] = lambda: _ce_version_stub()

    project_response = await client.post(
        "/api/projects", json={"name": "Acme Standards"}, headers=headers
    )
    assert project_response.status_code == 201
    project_iri = project_response.json()["project_iri"]

    put_response = await client.put(
        "/api/standards/company/frontend-stack",
        json={
            "title": "Frontend stack",
            "body_md": "# Frontend",
            "stack_pins": {"frontend": "next.js"},
            "policy_iri": _POLICY_IRI,
            "status": "active",
        },
        headers=headers,
    )
    assert put_response.status_code == 200

    effective_response = await client.get(
        "/api/standards/effective", params={"project_id": project_iri}, headers=headers
    )

    assert effective_response.status_code == 200
    body = effective_response.json()
    assert len(body["standards"]) == 1
    assert body["standards"][0]["standard_key"] == "frontend-stack"
    assert body["standards"][0]["stack_pins"] == {"frontend": "next.js"}


async def test_put_standard_403s_for_authenticated_non_admin_principal(
    client: AsyncClient,
) -> None:
    """QA edge case (BE-V1-TASK-001): ADR-010's tenant-admin fallback must
    actually gate a real, authenticated, non-admin tenant member -- not just
    reject callers with no membership row at all.
    """
    tenant_id = _unique_tenant("std-403")
    headers = await _non_admin_headers(tenant_id)
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_ok()

    response = await client.put(
        "/api/standards/company/lint",
        json={"title": "Lint rules", "body_md": "# Lint", "policy_iri": _POLICY_IRI},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json() == {"detail": {"error": "forbidden", "required_role": "admin"}}


async def test_put_standard_upsert_is_idempotent_not_duplicated(client: AsyncClient) -> None:
    """QA edge case (BE-V1-TASK-001): a second PUT at the same scope+key
    overwrites the existing row (ON CONFLICT DO UPDATE) rather than
    inserting a duplicate -- `GET /api/standards` must still show exactly
    one row for that key, with the latest title/body.
    """
    tenant_id = _unique_tenant("std-idem")
    headers = await _admin_headers(tenant_id)
    app.dependency_overrides[get_ce_read_client] = lambda: _ce_stub_ok()

    first = await client.put(
        "/api/standards/company/lint",
        json={
            "title": "Lint rules v1",
            "body_md": "# Lint v1",
            "policy_iri": _POLICY_IRI,
            "status": "active",
        },
        headers=headers,
    )
    assert first.status_code == 200

    second = await client.put(
        "/api/standards/company/lint",
        json={
            "title": "Lint rules v2",
            "body_md": "# Lint v2",
            "policy_iri": _POLICY_IRI,
            "status": "active",
        },
        headers=headers,
    )
    assert second.status_code == 200
    assert first.json()["standard_id"] == second.json()["standard_id"]

    list_response = await client.get(
        "/api/standards", params={"scope": "company"}, headers=headers
    )
    assert list_response.status_code == 200
    rows = list_response.json()["standards"]
    assert len(rows) == 1
    assert rows[0]["title"] == "Lint rules v2"
