"""PLAT-TASK-003 integration tests: cross-tenant isolation (mandatory),
member invite/duplicate rejection, and session-revocation-invalidates-token.

Marked both `integration` and `docker` per `test_local_stack.py`'s
precedent: CI's default `api` job runs with no compose services up, so
anything touching real Postgres/Redis/Oxigraph/LocalStack must skip cleanly
there and only run for real locally / in a dedicated docker-marked job.
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
from weave_backend.mock_oidc.app import app as mock_oidc_app
from weave_backend.mock_oidc.tokens import issue_token_pair
from weave_backend.rdf.oxigraph_client import clear_graph, load_graph, run_query
from weave_backend.rdf.query_rewriter import validate_query
from weave_backend.storage.tenant_objects import (
    list_tenant_object_keys,
    put_object,
    s3_client,
    tenant_prefix,
)
from weave_backend.tenancy.members import MemberAlreadyActive, activate_member, invite_member
from weave_backend.tenancy.sessions import bump_session_version
from weave_backend.tenancy.workspaces import create_workspace

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]

_BUCKET = "weave-tenant-objects-test"


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


async def test_cross_tenant_read_isolation(platform_stack: Path) -> None:
    tenant_a = _unique_tenant("tenant-a")
    tenant_b = _unique_tenant("tenant-b")

    async with tenant_connection(tenant_a) as conn:
        workspace_a = await create_workspace(
            conn, tenant_id=tenant_a, slug="ws", display_name="A workspace"
        )
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(
            conn, tenant_id=tenant_b, slug="ws", display_name="B workspace"
        )

    # 1. Postgres RLS: a raw, unfiltered SELECT scoped only by the session's
    # app.tenant_id setting must never see the other tenant's row -- proving
    # isolation holds even against a query that forgot a WHERE clause.
    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch("SELECT tenant_id, slug FROM workspaces")
    assert {r["tenant_id"] for r in rows} == {tenant_b}
    assert len(rows) == 1

    try:
        # 2. Oxigraph named graphs: each tenant's triples live in their own
        # graph; a query scoped to tenant B's graph must never surface
        # tenant A's data even though both are in the same Oxigraph store.
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)

        triple_a = "<urn:tenant-a:s> <urn:p> <urn:tenant-a:o> ."
        triple_b = "<urn:tenant-b:s> <urn:p> <urn:tenant-b:o> ."
        await load_graph(workspace_a.named_graph_iri, triple_a)
        await load_graph(workspace_b.named_graph_iri, triple_b)

        select_query = "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }"
        validate_query(select_query)
        result = await run_query(select_query, workspace_b.named_graph_iri)
        bindings = result["results"]["bindings"]
        subjects = {b["s"]["value"] for b in bindings}
        assert subjects == {"urn:tenant-b:s"}
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)

    # 3. LocalStack S3: prefix isolation -- listing tenant B's objects must
    # never return tenant A's key even though both live in the same bucket.
    client_s3 = s3_client()
    existing = {b["Name"] for b in client_s3.list_buckets().get("Buckets", [])}
    if _BUCKET not in existing:
        client_s3.create_bucket(Bucket=_BUCKET)
    key_a = f"{tenant_prefix(tenant_a)}{workspace_a.id}/note.txt"
    key_b = f"{tenant_prefix(tenant_b)}{workspace_b.id}/note.txt"
    put_object(client_s3, _BUCKET, key_a, b"tenant a secret")
    put_object(client_s3, _BUCKET, key_b, b"tenant b secret")

    keys_for_b = list_tenant_object_keys(client_s3, _BUCKET, tenant_b)
    assert keys_for_b == [key_b]


async def test_member_invite_and_duplicate_rejected(platform_stack: Path) -> None:
    tenant_id = _unique_tenant("tenant-invite")
    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Invite workspace"
        )
        member = await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="new-hire@acme-corp.example",
            role="editor",
        )
        assert member.status == "pending"

        await activate_member(
            conn, workspace_id=workspace.id, email="new-hire@acme-corp.example", user_sub="u-1"
        )

        with pytest.raises(MemberAlreadyActive):
            await invite_member(
                conn,
                tenant_id=tenant_id,
                workspace_id=workspace.id,
                email="new-hire@acme-corp.example",
                role="viewer",
            )


async def test_member_revocation_invalidates_session(
    client: AsyncClient, platform_stack: Path
) -> None:
    tenant_id = _unique_tenant("tenant-revoke")
    user_sub = "u-revoked"
    email = "revoked@example.invalid"

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Revoke workspace"
        )
        # QA FAIL remediation (AC-3): /switch now checks workspace role too,
        # so this test's principal needs a real membership row to reach the
        # session-revocation behaviour it actually exercises.
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=email, role="read"
        )
        await activate_member(conn, workspace_id=workspace.id, email=email, user_sub=user_sub)

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)

    # Sanity check: with a fresh session (version 0 == 0) switching works.
    ok_response = await client.post(
        f"/api/workspaces/{workspace.id}/switch",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert ok_response.status_code == 200

    await bump_session_version(tenant_id, user_sub)

    revoked_response = await client.post(
        f"/api/workspaces/{workspace.id}/switch",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
    )
    assert revoked_response.status_code == 401
    assert revoked_response.json()["detail"]["error"] == "session_revoked"


async def test_member_revoke_route_removes_row_and_is_idempotent(
    client: AsyncClient, platform_stack: Path
) -> None:
    """QA edge case (AC-3): drives the *actual* `DELETE
    /api/workspaces/{wid}/members/{uid}` HTTP route -- not just the
    session-version-bump half already covered by
    `test_member_revocation_invalidates_session` above -- and asserts the
    role binding is really gone from the table. Also checks the brief's
    idempotent-delete shape: revoking an already-gone member stays 204,
    never 404/500.
    """
    tenant_id = _unique_tenant("tenant-revoke-http")
    admin_sub = "u-admin"
    member_sub = "u-member"

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Revoke-via-HTTP workspace"
        )
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="member@acme-corp.example",
            role="viewer",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="member@acme-corp.example", user_sub=member_sub
        )
        # PLAT-TASK-004: revoke is now gated on an "admin" workspace role --
        # this workspace was created via a raw `create_workspace()` call, not
        # the `POST /tenants/{id}/workspaces` route, so it skips that route's
        # creator-auto-admin bootstrap. Grant it explicitly.
        await invite_member(
            conn,
            tenant_id=tenant_id,
            workspace_id=workspace.id,
            email="admin@acme-corp.example",
            role="admin",
        )
        await activate_member(
            conn, workspace_id=workspace.id, email="admin@acme-corp.example", user_sub=admin_sub
        )

    admin_tokens = await issue_token_pair(sub=admin_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {admin_tokens.access_token}"}

    first_delete = await client.delete(
        f"/api/workspaces/{workspace.id}/members/{member_sub}", headers=headers
    )
    assert first_delete.status_code == 204

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_sub = $2",
            workspace.id,
            member_sub,
        )
    assert rows == [], "role binding must actually be removed from the table"

    # Idempotency: revoking an already-revoked (non-existent) member is a
    # no-op, still 204 -- never a 404 or 500 for a repeat delete.
    second_delete = await client.delete(
        f"/api/workspaces/{workspace.id}/members/{member_sub}", headers=headers
    )
    assert second_delete.status_code == 204


async def test_settings_route_cache_invalidated_on_write(
    client: AsyncClient, platform_stack: Path
) -> None:
    """QA validation (AC-4): `settings/cache.py` had zero test coverage
    anywhere in the suite before this -- the 30s-TTL Redis cache and its
    invalidate-on-write path were unverified. Drives the actual `GET`/`PUT
    /api/settings/{key}` HTTP routes: a `GET` populates the cache, a `PUT`
    changing the value must invalidate it so the *next* `GET` sees the new
    value rather than a stale cached one.
    """
    tenant_id = _unique_tenant("tenant-settings-cache")
    company_iri = f"urn:weave:tenant:{tenant_id}:company"
    user_sub = "u-settings-admin"
    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    await client.put(
        "/api/settings/theme",
        json={"scope_iri": company_iri, "value": "dark"},
        headers=headers,
    )

    first_get = await client.get(
        "/api/settings/theme", params={"context": company_iri}, headers=headers
    )
    assert first_get.status_code == 200
    assert first_get.json()["value"] == "dark"  # now cached

    put_response = await client.put(
        "/api/settings/theme",
        json={"scope_iri": company_iri, "value": "light"},
        headers=headers,
    )
    assert put_response.status_code == 200

    second_get = await client.get(
        "/api/settings/theme", params={"context": company_iri}, headers=headers
    )
    assert second_get.status_code == 200
    assert second_get.json()["value"] == "light", "stale cached value served after invalidation"


async def test_settings_write_emits_audit_event(client: AsyncClient, platform_stack: Path) -> None:
    """QA finding: `PUT /api/settings/{key}` was the only one of the four
    mutation routes in this task that never called through the audit
    seam. Proves a row lands in `audit_entries` for the tenant, mirroring
    the workspace-created/member-invited/member-revoked call sites.
    """
    tenant_id = _unique_tenant("tenant-settings-audit")
    company_iri = f"urn:weave:tenant:{tenant_id}:company"
    tokens = await issue_token_pair(sub="u-settings-admin", tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    put_response = await client.put(
        "/api/settings/theme",
        json={"scope_iri": company_iri, "value": "dark"},
        headers=headers,
    )
    assert put_response.status_code == 200

    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT event_type, target_iri FROM audit_entries WHERE tenant_id = $1", tenant_id
        )
    assert len(rows) == 1
    assert rows[0]["event_type"] == "setting.changed"
    assert rows[0]["target_iri"] == company_iri


async def test_sparql_curie_graph_clause_cannot_cross_scope(platform_stack: Path) -> None:
    """PR #11 finding (1a): a CURIE-form GRAPH clause (`GRAPH ws:xyz`, not
    `GRAPH <iri>`) survives algebra validation just fine -- rdflib resolves
    the CURIE before the structural check runs -- but the *old* regex-based
    rewrite step only matched `GRAPH <iri>`/`GRAPH ?var`, so it silently
    no-op'd on this form and the attacker's own graph IRI reached Oxigraph
    unchanged (reviewer reproduced: rewrite output == input byte-for-byte).
    Proves the fix against a real Oxigraph: the query text still names
    workspace B's graph via CURIE, but `run_query` scopes the *dataset* to
    workspace A's graph via the SPARQL 1.1 Protocol params, so the CURIE
    clause matches nothing.
    """
    tenant_a = _unique_tenant("tenant-curie-a")
    tenant_b = _unique_tenant("tenant-curie-b")
    async with tenant_connection(tenant_a) as conn:
        workspace_a = await create_workspace(conn, tenant_id=tenant_a, slug="ws", display_name="A")
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(conn, tenant_id=tenant_b, slug="ws", display_name="B")

    try:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)
        await load_graph(workspace_a.named_graph_iri, "<urn:curie-a:s> <urn:p> <urn:curie-a:o> .")
        await load_graph(workspace_b.named_graph_iri, "<urn:curie-b:s> <urn:p> <urn:curie-b:o> .")

        graph_prefix, _, graph_local = workspace_b.named_graph_iri.rpartition(":")
        curie_query = (
            f"PREFIX ws: <{graph_prefix}:>\n"
            f"SELECT * WHERE {{ GRAPH ws:{graph_local} {{ ?s ?p ?o }} }}"
        )
        validate_query(curie_query)  # structurally valid -- passes the choke point

        result = await run_query(curie_query, workspace_a.named_graph_iri)

        assert result["results"]["bindings"] == []
    finally:
        await clear_graph(workspace_a.named_graph_iri)
        await clear_graph(workspace_b.named_graph_iri)


async def test_invite_member_route_rejects_foreign_workspace(client: AsyncClient) -> None:
    """PR #11 finding (2, IDOR): `POST /workspaces/{id}/members` never
    checked that `workspace_id` actually belongs to the caller's tenant --
    the workspaces FK is cross-tenant and RLS only constrains the tenant_id
    *column being written*, so tenant A could invite into tenant B's real
    workspace. Must 404, not silently create a foreign-tenant membership row.
    """
    tenant_a = _unique_tenant("tenant-idor-a")
    tenant_b = _unique_tenant("tenant-idor-b")
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(conn, tenant_id=tenant_b, slug="ws", display_name="B")

    tokens = await issue_token_pair(sub="u-attacker", tenant_id=tenant_a)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.post(
        f"/api/workspaces/{workspace_b.id}/members",
        json={"email": "victim@tenant-b.example", "role": "viewer"},
        headers=headers,
    )

    assert response.status_code == 404

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch(
            "SELECT 1 FROM workspace_members WHERE workspace_id = $1", workspace_b.id
        )
    assert rows == [], "no membership row must be created against a foreign workspace"


async def test_revoke_member_route_rejects_foreign_workspace(client: AsyncClient) -> None:
    """PR #11 finding (2, IDOR): same gap on revoke -- must 404 on a
    foreign workspace_id rather than silently succeeding (204) with no-op.
    """
    tenant_a = _unique_tenant("tenant-idor-revoke-a")
    tenant_b = _unique_tenant("tenant-idor-revoke-b")
    async with tenant_connection(tenant_b) as conn:
        workspace_b = await create_workspace(conn, tenant_id=tenant_b, slug="ws", display_name="B")

    tokens = await issue_token_pair(sub="u-attacker", tenant_id=tenant_a)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.delete(
        f"/api/workspaces/{workspace_b.id}/members/some-user-sub",
        headers=headers,
    )

    assert response.status_code == 404


async def test_set_setting_route_rejects_foreign_tenant_scope_iri(client: AsyncClient) -> None:
    """PR #11 finding 4: `PUT /api/settings/{key}` never checked the
    tenant segment of `scope_iri` against `principal.tenant_id` -- tenant A
    could write into tenant B's settings row (a global `UNIQUE(scope_iri,
    key)` meant the write raced tenant B's real row). Must 403, not 200.
    """
    tenant_a = _unique_tenant("tenant-settings-idor-a")
    tenant_b = _unique_tenant("tenant-settings-idor-b")
    foreign_scope_iri = f"urn:weave:tenant:{tenant_b}:company"

    tokens = await issue_token_pair(sub="u-attacker", tenant_id=tenant_a)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.put(
        "/api/settings/theme",
        json={"scope_iri": foreign_scope_iri, "value": "dark"},
        headers=headers,
    )

    assert response.status_code == 403

    async with tenant_connection(tenant_b) as conn:
        rows = await conn.fetch(
            "SELECT 1 FROM settings WHERE scope_iri = $1 AND key = 'theme'", foreign_scope_iri
        )
    assert rows == [], "no setting row must be written against a foreign tenant scope_iri"


async def test_get_setting_route_rejects_foreign_tenant_context(client: AsyncClient) -> None:
    """PR #11 finding 4: same gap on read -- `context` query param's
    tenant segment was never checked either.
    """
    tenant_a = _unique_tenant("tenant-settings-idor-read-a")
    tenant_b = _unique_tenant("tenant-settings-idor-read-b")
    foreign_context_iri = f"urn:weave:tenant:{tenant_b}:company"

    tokens = await issue_token_pair(sub="u-attacker", tenant_id=tenant_a)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    response = await client.get(
        "/api/settings/theme", params={"context": foreign_context_iri}, headers=headers
    )

    assert response.status_code == 403


async def test_revoked_session_rejected_on_sparql_route(
    client: AsyncClient, platform_stack: Path
) -> None:
    """PR #11 finding 3: session revocation was only enforced on
    `POST /workspaces/{id}/switch` (via `require_active_session`) -- every
    other authenticated route used plain `get_current_principal`, so a
    revoked member's still-live access token kept working against
    `/api/sparql` (and settings/tenancy routes) for up to the token's
    remaining TTL. Must 401 immediately, same as `/switch` already does.
    """
    tenant_id = _unique_tenant("tenant-revoke-sparql")
    user_sub = "u-revoked-sparql"
    email = "revoked-sparql@example.invalid"

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Revoke-sparql workspace"
        )
        # QA FAIL remediation (AC-3): /sparql now checks workspace role too.
        await invite_member(
            conn, tenant_id=tenant_id, workspace_id=workspace.id, email=email, role="read"
        )
        await activate_member(conn, workspace_id=workspace.id, email=email, user_sub=user_sub)

    tokens = await issue_token_pair(sub=user_sub, tenant_id=tenant_id)
    headers = {"Authorization": f"Bearer {tokens.access_token}"}

    ok_response = await client.post(
        "/api/sparql",
        json={"query": "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }", "workspace_id": workspace.id},
        headers=headers,
    )
    assert ok_response.status_code == 200

    await bump_session_version(tenant_id, user_sub)

    revoked_response = await client.post(
        "/api/sparql",
        json={"query": "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }", "workspace_id": workspace.id},
        headers=headers,
    )
    assert revoked_response.status_code == 401
    assert revoked_response.json()["detail"]["error"] == "session_revoked"
