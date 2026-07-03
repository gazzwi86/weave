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
from weave_backend.rdf.query_rewriter import rewrite_query
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
        query = rewrite_query(select_query, workspace_b.named_graph_iri)
        result = await run_query(query)
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

    async with tenant_connection(tenant_id) as conn:
        workspace = await create_workspace(
            conn, tenant_id=tenant_id, slug="ws", display_name="Revoke workspace"
        )

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
