"""PLAT-TASK-004 integration tests: agent STS auth mints a registry row and
an audit event, revoked-session distinguishes 401 from 403, the agent
registry never leaks across tenants, and RBAC actually blocks an
insufficient-role actor at the HTTP layer (AC-2/AC-3/AC-4/AC-6/AC-7).

Marked both `integration` and `docker` per `test_local_stack.py`'s
precedent: CI's default `api` job runs no compose services, so anything
touching real Postgres/Redis/LocalStack skips cleanly and only runs real
locally or in the dedicated docker-marked job.
"""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from weave_backend import app
from weave_backend.auth.oidc_client import get_oidc_client
from weave_backend.db.pool import tenant_connection
from weave_backend.identity.registry import agent_principal_iri
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.tenancy.members import activate_member, invite_member
from weave_backend.tenancy.sessions import bump_session_version
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

# LocalStack community edition's STS emulator accepts any session token
# unconditionally and always resolves it to this fixed root identity --
# verified empirically (see progress summary); there is no input that makes
# it reject a `GetCallerIdentity` call, so the success path is what's real
# to test against it.
_ROOT_ARN = "arn:aws:iam::000000000000:root"


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


async def _create_workspace_via_route(
    client: AsyncClient, *, tenant_id: str, admin_sub: str, slug: str
) -> tuple[str, dict[str, str]]:
    """Creates a workspace through the real HTTP route (not a raw DB call),
    so the creator gets the router's auto-admin-membership bootstrap.
    """
    tokens = await issue_token_pair(sub=admin_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}
    response = await client.post(
        f"/api/tenants/{tenant_id}/workspaces",
        json={"slug": slug, "display_name": slug},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"], headers


async def test_agent_sts_auth_mints_iri(client: AsyncClient) -> None:
    """AC-2: a valid STS session token mints a platform agent JWT (TTL 60s)
    and registers the agent under the workspace's tenant, auditing the
    registration.
    """
    tenant_id = _unique_tenant("tenant-agent")
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="agent-ws", display_name="Agent workspace"
        )

    response = await client.post(
        "/api/auth/agent-token",
        json={"sts_token": "any-session-token", "workspace_id": workspace.id},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    expected_iri = agent_principal_iri(_ROOT_ARN)
    assert body["principal_iri"] == expected_iri
    assert body["expires_in"] == 60
    assert body["agent_token"]

    async with tenant_connection(tenant_id) as conn:
        principal_row = await conn.fetchrow(
            "SELECT type, workspace_id FROM principals WHERE tenant_id = $1 AND iri = $2",
            tenant_id,
            expected_iri,
        )
        audit_row = await conn.fetchrow(
            "SELECT event_type, subject_iri FROM audit_events"
            " WHERE tenant_id = $1 AND event_type = 'agent.registered'",
            tenant_id,
        )
    assert principal_row is not None
    assert principal_row["type"] == "agent"
    assert str(principal_row["workspace_id"]) == workspace.id
    assert audit_row is not None
    assert audit_row["subject_iri"] == expected_iri


async def test_agent_registry_tenant_scoped(client: AsyncClient) -> None:
    """AC-7: `GET /api/agents` only ever returns the caller's own tenant's
    agents -- zero cross-tenant rows, even when asked about a workspace_id
    that belongs to a different (real) tenant.
    """
    tenant_a = _unique_tenant("tenant-a")
    tenant_b = _unique_tenant("tenant-b")
    async with tenant_connection(tenant_a) as conn:
        workspace_a = await create_workspace(
            conn, tenant_id=tenant_a, slug="ws-a", display_name="Workspace A"
        )

    mint_response = await client.post(
        "/api/auth/agent-token",
        json={"sts_token": "any-session-token", "workspace_id": workspace_a.id},
    )
    assert mint_response.status_code == 200, mint_response.text

    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)

    own_tenant_response = await client.get(
        f"/api/agents?workspace_id={workspace_a.id}",
        headers={"Authorization": f"Bearer {tokens_a.access_token}"},
    )
    assert own_tenant_response.status_code == 200
    assert len(own_tenant_response.json()["agents"]) == 1

    foreign_tenant_response = await client.get(
        f"/api/agents?workspace_id={workspace_a.id}",
        headers={"Authorization": f"Bearer {tokens_b.access_token}"},
    )
    assert foreign_tenant_response.status_code == 200
    assert foreign_tenant_response.json()["agents"] == []


async def test_revoked_session_returns_401(client: AsyncClient) -> None:
    """AC-4: a revoked session's still-live token is rejected with a 401
    body distinct from a 403 (`session_revoked`, not `forbidden`).
    """
    tenant_id = _unique_tenant("tenant-revoke")
    user_sub = "u-revoked"
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    before = await client.get("/api/whoami", headers=headers)
    assert before.status_code == 200

    await bump_session_version(tenant_id, user_sub)

    after = await client.get("/api/whoami", headers=headers)
    assert after.status_code == 401
    assert after.json()["detail"] == {"error": "session_revoked"}


async def test_rbac_author_cannot_delete_member(client: AsyncClient) -> None:
    """AC-3 (deviation note: the brief's named E2E scenario needs a delete
    affordance the UI doesn't ship until TASK-005 -- this is the API-level
    enforcement test the brief's own fallback invites). An "author" role is
    below the "admin" ceiling `require_workspace_role` enforces on member
    revocation, so the attempt 403s with the required-role detail shape.
    """
    tenant_id = _unique_tenant("tenant-author")
    admin_sub = "u-admin"
    author_sub = "u-author"
    workspace_id, _admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub=admin_sub, slug="author-ws"
    )
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email="author@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace_id, email="author@example.invalid", user_sub=author_sub
        )

    author_tokens = await issue_token_pair(sub=author_sub, tenant_id=tenant_id)
    response = await client.delete(
        f"/api/workspaces/{workspace_id}/members/{admin_sub}",
        headers={"Authorization": f"Bearer {author_tokens.access_token}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == {"error": "forbidden", "required_role": "admin"}


async def test_get_principal_route_is_admin_only(client: AsyncClient) -> None:
    """AC-6: an admin can look up any principal in their own tenant by IRI;
    a non-admin (author) role is rejected, and an unknown IRI 404s.
    """
    tenant_id = _unique_tenant("tenant-principal")
    admin_sub = "u-admin"
    author_sub = "u-author"
    workspace_id, admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub=admin_sub, slug="principal-ws"
    )
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email="author2@example.invalid",
            role="author",
        )
        await activate_member(
            conn, workspace_id=workspace_id, email="author2@example.invalid", user_sub=author_sub
        )
    author_tokens = await issue_token_pair(sub=author_sub, tenant_id=tenant_id)

    found = await client.get(
        f"/api/principals/urn:weave:principal:user:{admin_sub}", headers=admin_headers
    )
    assert found.status_code == 200
    body = found.json()
    assert body["iri"] == f"urn:weave:principal:user:{admin_sub}"
    assert {"workspace_id": workspace_id, "role": "admin"} in body["workspace_memberships"]

    missing = await client.get(
        "/api/principals/urn:weave:principal:user:ghost", headers=admin_headers
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == {"error": "principal_not_found"}

    forbidden = await client.get(
        f"/api/principals/urn:weave:principal:user:{admin_sub}",
        headers={"Authorization": f"Bearer {author_tokens.access_token}"},
    )
    assert forbidden.status_code == 403


async def test_get_principal_route_never_leaks_cross_tenant(client: AsyncClient) -> None:
    """QA edge case (AC-6): an admin of tenant A must not be able to look up
    a *real*, existing principal that belongs to tenant B by guessing its
    IRI -- the existing brief test only proves a non-existent IRI 404s
    within one tenant; this proves a genuine cross-tenant row is equally
    invisible (get_principal's `WHERE tenant_id = $1 AND iri = $2` must
    never widen to a bare `iri` lookup).
    """
    tenant_a = _unique_tenant("tenant-a-lookup")
    tenant_b = _unique_tenant("tenant-b-lookup")
    admin_a_sub = "u-admin-a"
    admin_b_sub = "u-admin-b"  # distinct sub -- a genuinely different IRI
    _workspace_a, admin_a_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_a, admin_sub=admin_a_sub, slug="ws-a-lookup"
    )
    await _create_workspace_via_route(
        client, tenant_id=tenant_b, admin_sub=admin_b_sub, slug="ws-b-lookup"
    )

    # tenant B's admin principal genuinely exists (created above) -- tenant
    # A's admin asks for it by its literal IRI string.
    cross_tenant = await client.get(
        f"/api/principals/urn:weave:principal:user:{admin_b_sub}",
        headers=admin_a_headers,
    )
    assert cross_tenant.status_code == 404
    assert cross_tenant.json()["detail"] == {"error": "principal_not_found"}


@pytest.mark.xfail(
    strict=True,
    reason=(
        "AC-3 gap (deviation #4 / cross-task ledger 'PLAT-EPIC-003 PR review' "
        "finding, assigned to this task): settings and workspace-switch routes "
        "check only tenant identity via get_current_principal, not workspace "
        "membership or role. A tenant member with zero workspace_members row "
        "for this workspace can still read/write its settings and switch into "
        "it. Remove this xfail once settings/switch are gated on "
        "require_workspace_role (or an equivalent membership check)."
    ),
)
async def test_non_member_can_reach_workspace_settings_and_switch(client: AsyncClient) -> None:
    """QA edge case documenting the deviation-4 gap: a valid principal of the
    *same tenant* who has never been invited to this workspace (no
    workspace_members row at all, not even "read") should be forbidden from
    reading/writing its settings or switching into it -- AC-3 says "every
    endpoint checks role". Currently both succeed with 200.
    """
    tenant_id = _unique_tenant("tenant-outsider")
    workspace_id, _admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="outsider-ws"
    )
    outsider_tokens = await issue_token_pair(sub="u-outsider", tenant_id=tenant_id)
    outsider_headers = {"Authorization": f"Bearer {outsider_tokens.access_token}"}

    switch_response = await client.post(
        f"/api/workspaces/{workspace_id}/switch", headers=outsider_headers
    )
    assert switch_response.status_code == 403, switch_response.text

    settings_response = await client.get(
        "/api/settings/some-key",
        params={"context": f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"},
        headers=outsider_headers,
    )
    assert settings_response.status_code == 403, settings_response.text
