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
    """AC-7: `GET /api/agents` requires read-role membership in the target
    workspace (PR #12 review finding 1 -- same AC-3 class as the settings/
    sparql/switch gap: a tenant member with zero membership rows there could
    enumerate every agent). Only a member ever sees the list; both a foreign
    tenant and a same-tenant non-member get 403, never a leaked row.
    """
    tenant_a = _unique_tenant("tenant-a")
    tenant_b = _unique_tenant("tenant-b")
    lister_email = "lister@example.invalid"
    async with tenant_connection(tenant_a) as conn:
        workspace_a = await create_workspace(
            conn, tenant_id=tenant_a, slug="ws-a", display_name="Workspace A"
        )
        await invite_member(
            conn, tenant_id=tenant_a, workspace_id=workspace_a.id, email=lister_email, role="read"
        )
        await activate_member(
            conn, workspace_id=workspace_a.id, email=lister_email, user_sub="u-a"
        )

    mint_response = await client.post(
        "/api/auth/agent-token",
        json={"sts_token": "any-session-token", "workspace_id": workspace_a.id},
    )
    assert mint_response.status_code == 200, mint_response.text

    tokens_a = await issue_token_pair(sub="u-a", tenant_id=tenant_a)
    tokens_b = await issue_token_pair(sub="u-b", tenant_id=tenant_b)
    tokens_outsider = await issue_token_pair(sub="u-outsider", tenant_id=tenant_a)

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
    assert foreign_tenant_response.status_code == 403

    outsider_response = await client.get(
        f"/api/agents?workspace_id={workspace_a.id}",
        headers={"Authorization": f"Bearer {tokens_outsider.access_token}"},
    )
    assert outsider_response.status_code == 403


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


async def test_non_member_can_reach_workspace_settings_and_switch(client: AsyncClient) -> None:
    """QA FAIL remediation (AC-3, was deviation #4): a valid principal of the
    *same tenant* who has never been invited to this workspace (no
    workspace_members row at all, not even "read") must be forbidden from
    reading/writing its settings or switching into it -- AC-3 says "every
    endpoint checks role", with no carve-out.
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


async def test_member_with_required_role_can_reach_workspace_settings_and_switch(
    client: AsyncClient,
) -> None:
    """Positive counterpart to the outsider test above: an actual member
    (the workspace creator, auto-admin per PLAT-TASK-004's bootstrap) must
    still succeed once role gating is added -- proves the fix isn't a
    blanket 403 for the whole tenant.
    """
    tenant_id = _unique_tenant("tenant-member")
    workspace_id, admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="member-ws"
    )

    switch_response = await client.post(
        f"/api/workspaces/{workspace_id}/switch", headers=admin_headers
    )
    assert switch_response.status_code == 200, switch_response.text

    settings_response = await client.get(
        "/api/settings/some-key",
        params={"context": f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"},
        headers=admin_headers,
    )
    # The role gate passed and the request reached the resolver -- the key
    # simply doesn't exist yet, so 404 (not 403) is the proof of success.
    assert settings_response.status_code == 404, settings_response.text


async def test_non_member_forbidden_on_settings_write_and_sparql(client: AsyncClient) -> None:
    """QA re-validation of 5bf7d04 (AC-3, item 1): the earlier outsider test
    only proved settings-GET and switch 403 for a zero-membership principal.
    `PUT /api/settings/{key}` (author ceiling) and `POST /api/sparql` are
    the other two named routes in AC-3's "every endpoint checks role" list
    and had zero negative coverage until now.
    """
    tenant_id = _unique_tenant("tenant-outsider2")
    workspace_id, _admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="outsider2-ws"
    )
    outsider_tokens = await issue_token_pair(sub="u-outsider2", tenant_id=tenant_id)
    outsider_headers = {"Authorization": f"Bearer {outsider_tokens.access_token}"}

    settings_put = await client.put(
        "/api/settings/some-key",
        json={
            "scope_iri": f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}",
            "value": "x",
        },
        headers=outsider_headers,
    )
    assert settings_put.status_code == 403, settings_put.text

    sparql_response = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": workspace_id,
        },
        headers=outsider_headers,
    )
    assert sparql_response.status_code == 403, sparql_response.text


async def test_read_role_member_cannot_write_settings_author_ceiling(
    client: AsyncClient,
) -> None:
    """QA re-validation of 5bf7d04 (AC-3/ADR-007, item 4): ADR-007 sets the
    settings-write ceiling at "author", not merely "member". A workspace
    member holding only "read" must still 403 on the PUT route -- membership
    alone isn't enough, the role rank must clear the ceiling too. An
    "author" member, by contrast, must succeed (200).
    """
    tenant_id = _unique_tenant("tenant-ceiling")
    workspace_id, _admin_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin", slug="ceiling-ws"
    )
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email="reader@example.invalid",
            role="read",
        )
        await activate_member(
            conn, workspace_id=workspace_id, email="reader@example.invalid", user_sub="u-reader"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            email="author3@example.invalid",
            role="author",
        )
        await activate_member(
            conn,
            workspace_id=workspace_id,
            email="author3@example.invalid",
            user_sub="u-author3",
        )
    reader_tokens = await issue_token_pair(sub="u-reader", tenant_id=tenant_id)
    author_tokens = await issue_token_pair(sub="u-author3", tenant_id=tenant_id)
    scope_iri = f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"

    reader_response = await client.put(
        "/api/settings/some-key",
        json={"scope_iri": scope_iri, "value": "x"},
        headers={"Authorization": f"Bearer {reader_tokens.access_token}"},
    )
    assert reader_response.status_code == 403, reader_response.text

    author_response = await client.put(
        "/api/settings/some-key",
        json={"scope_iri": scope_iri, "value": "x"},
        headers={"Authorization": f"Bearer {author_tokens.access_token}"},
    )
    assert author_response.status_code == 200, author_response.text


async def test_workspace_role_enforced_against_the_requested_workspace_not_another(
    client: AsyncClient,
) -> None:
    """QA re-validation of 5bf7d04 (item 2): a member of workspace A, with a
    real role there, must still 403 on switch/settings/sparql for workspace
    B (same tenant, different workspace, no membership row) -- proves
    `enforce_workspace_role` resolves membership against the *requested*
    workspace_id, never the caller's other/active workspace.
    """
    tenant_id = _unique_tenant("tenant-cross-ws")
    workspace_a, _admin_a_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-cross", slug="cross-ws-a"
    )
    workspace_b, _admin_b_headers = await _create_workspace_via_route(
        client, tenant_id=tenant_id, admin_sub="u-admin-cross-b", slug="cross-ws-b"
    )
    async with tenant_connection(tenant_id) as conn:
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace_a,
            email="member-a@example.invalid",
            role="admin",
        )
        await activate_member(
            conn,
            workspace_id=workspace_a,
            email="member-a@example.invalid",
            user_sub="u-member-a",
        )
    member_a_tokens = await issue_token_pair(sub="u-member-a", tenant_id=tenant_id)
    member_a_headers = {"Authorization": f"Bearer {member_a_tokens.access_token}"}

    switch_response = await client.post(
        f"/api/workspaces/{workspace_b}/switch", headers=member_a_headers
    )
    assert switch_response.status_code == 403, switch_response.text

    settings_response = await client.get(
        "/api/settings/some-key",
        params={"context": f"urn:weave:tenant:{tenant_id}:ws:{workspace_b}"},
        headers=member_a_headers,
    )
    assert settings_response.status_code == 403, settings_response.text

    sparql_response = await client.post(
        "/api/sparql",
        json={
            "query": "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }",
            "workspace_id": workspace_b,
        },
        headers=member_a_headers,
    )
    assert sparql_response.status_code == 403, sparql_response.text

    # Sanity: the same member, same role, against their *own* workspace A,
    # still succeeds -- proves the 403s above are workspace-specific, not a
    # blanket break.
    own_switch_response = await client.post(
        f"/api/workspaces/{workspace_a}/switch", headers=member_a_headers
    )
    assert own_switch_response.status_code == 200, own_switch_response.text
