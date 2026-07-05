"""Mints the next graph version for a workspace (CE-WRITE-1's `version_iri`).

Follows the `HashChainAuditEmitter` pattern (`audit/emitter.py`): a
per-workspace `pg_advisory_xact_lock` serialises concurrent "read latest,
bump, insert" sequences within the caller's already-open transaction, so
two concurrent applies never mint the same version number.
"""

from __future__ import annotations

import asyncpg

_INITIAL_SEMVER = "0.1.0"


def _bump_patch(semver: str) -> str:
    major, minor, patch = semver.split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


async def mint_version(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, named_graph_iri: str
) -> tuple[str, str]:
    """Returns `(version_iri, semver)` for the next version of the given
    workspace's working graph, recording it in `graph_versions`.
    """
    await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", f"{tenant_id}:{workspace_id}")

    row = await conn.fetchrow(
        "SELECT semver FROM graph_versions WHERE tenant_id = $1 AND workspace_id = $2 "
        "ORDER BY created_at DESC LIMIT 1",
        tenant_id,
        workspace_id,
    )
    semver = _INITIAL_SEMVER if row is None else _bump_patch(str(row["semver"]))
    version_iri = f"{named_graph_iri}:v{semver}"

    await conn.execute(
        "INSERT INTO graph_versions (tenant_id, workspace_id, semver, version_iri) "
        "VALUES ($1, $2, $3, $4)",
        tenant_id,
        workspace_id,
        semver,
        version_iri,
    )
    return version_iri, semver
