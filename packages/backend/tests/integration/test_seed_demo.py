"""Runnable check for `db/seed_demo.py`: seeding is idempotent and actually
leaves a workspace-scoped login usable (the two failure modes that matter
for the PoC -- a re-run duplicating graph versions, or a fresh demo user
missing the Redis active-workspace pointer and 400ing on every route).
Marked `integration`/`docker` per this directory's convention (real
Postgres/Redis/Oxigraph, skipped where docker isn't available).
"""

from __future__ import annotations

import os
import shutil
import uuid

import pytest
import redis.asyncio as redis

import weave_backend.db.seed_demo as seed_demo
from weave_backend.audit.verify import verify_chain
from weave_backend.db.pool import tenant_connection
from weave_backend.rdf.oxigraph_client import clear_graph, run_query

pytestmark = [
    pytest.mark.integration,
    pytest.mark.docker,
    pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed"),
]


def _redis_url() -> str:
    # Mirrors tenancy/sessions.py:35-37 -- honour WEAVE_REDIS_PORT so this
    # test finds the same Redis the app just wrote to under port-isolated
    # (multi-worktree) runs, not always the default 6379.
    port = os.environ.get("REDIS_PORT", os.environ.get("WEAVE_REDIS_PORT", "6379"))
    return f"redis://localhost:{port}/0"


async def _triple_count(named_graph_iri: str) -> int:
    result = await run_query("SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }", named_graph_iri)
    return int(result["results"]["bindings"][0]["c"]["value"])


async def test_seed_demo_is_idempotent_and_activates_both_logins(
    platform_stack: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant_id = f"seed-test-{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(seed_demo, "TENANT_ID", tenant_id)

    try:
        first = await seed_demo.seed()
        second = await seed_demo.seed()

        assert first["created"] is True
        assert second["created"] is False
        assert first["workspace_id"] == second["workspace_id"]

        workspace_id = str(first["workspace_id"])
        async with tenant_connection(tenant_id) as conn:
            members = await conn.fetch(
                "SELECT email, status, role FROM workspace_members WHERE tenant_id = $1",
                tenant_id,
            )
            assert {m["email"]: m["status"] for m in members} == {
                "admin@weave.local": "active",
                "client@weave.local": "active",
            }
            # SE2: canonical role slugs (rbac.py's ROLE_RANK), not the
            # legacy "admin"/"author" strings -- members-panel.tsx's
            # <select> only offers CANONICAL_ROLES, so a non-canonical
            # role silently fails to select any option (renders blank).
            assert {m["email"]: m["role"] for m in members} == {
                "admin@weave.local": "workspace_admin",
                "client@weave.local": "brand_content_owner",
            }
            versions = await conn.fetch(
                "SELECT status FROM graph_versions WHERE tenant_id = $1", tenant_id
            )
            assert [v["status"] for v in versions] == ["published"]

            # A1 (docs/design/remediation-2-api-gaps.md): the seeded tenant's
            # audit chain must pass verification -- this was the untested gap
            # behind the demo "Chain broken" banner investigation.
            audit_result = await verify_chain(conn, tenant_id)
            assert audit_result.valid is True, audit_result
            assert audit_result.entries_checked >= 1

        named_graph_iri = f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"
        assert await _triple_count(named_graph_iri) > 0

        redis_client = redis.from_url(_redis_url(), decode_responses=True)
        try:
            for sub in ("admin", "client"):
                assert await redis_client.get(
                    f"active_workspace:{tenant_id}:{sub}"
                ) == workspace_id
        finally:
            await redis_client.aclose()
    finally:
        await _cleanup(tenant_id)


async def _cleanup(tenant_id: str) -> None:
    # ponytail: graph_versions/principals/audit_entries are deliberately
    # append-only (no DELETE grant for weave_app -- migrations
    # 0002/0005/0006) so this only clears what the schema actually lets an
    # app-role connection clear: the RDF graphs, workspace/membership rows,
    # and the Redis pointer. Leftover rows under this test's random
    # tenant_id are harmless and RLS-invisible to every other tenant.
    async with tenant_connection(tenant_id) as conn:
        rows = await conn.fetch(
            "SELECT id, named_graph_iri FROM workspaces WHERE tenant_id = $1", tenant_id
        )
        for row in rows:
            version_rows = await conn.fetch(
                "SELECT version_iri FROM graph_versions WHERE tenant_id = $1 AND workspace_id = $2",
                tenant_id,
                str(row["id"]),
            )
            for v in version_rows:
                await clear_graph(v["version_iri"])
            await clear_graph(row["named_graph_iri"])
        await conn.execute("DELETE FROM workspace_members WHERE tenant_id = $1", tenant_id)
        await conn.execute("DELETE FROM workspaces WHERE tenant_id = $1", tenant_id)
    redis_client = redis.from_url(_redis_url(), decode_responses=True)
    try:
        await redis_client.delete(
            f"active_workspace:{tenant_id}:admin", f"active_workspace:{tenant_id}:client"
        )
    finally:
        await redis_client.aclose()
