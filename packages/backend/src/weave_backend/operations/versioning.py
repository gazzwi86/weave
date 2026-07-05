"""Mints, lists, and publishes graph versions for a workspace (CE-VERSION-1).

Every commit mints a new *draft* row (`mint_version`, CE-WRITE-1's
`version_iri`). CE-TASK-002 adds the draft->published lifecycle on top:
`publish_version` flips a draft row to published (immutable thereafter,
AC-002-07/-09), `resolve_version` resolves the `?version=latest` alias to
the newest *published* row (AC-002-08, never a draft), and `list_versions`
serves the paginated history (AC-002-11).

Follows the `HashChainAuditEmitter` pattern (`audit/emitter.py`): a
per-workspace `pg_advisory_xact_lock` serialises concurrent "read latest,
bump, insert" sequences within the caller's already-open transaction, so
two concurrent applies never mint the same version number. `publish_version`
needs no such lock -- its `UPDATE ... WHERE status = 'draft'` is itself the
race-safe compare-and-swap (see its docstring).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import asyncpg

_INITIAL_SEMVER = "0.1.0"


def _bump_patch(semver: str) -> str:
    major, minor, patch = semver.split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


class VersionNotFound(Exception):
    """No `graph_versions` row matches the requested version_iri/tenant."""


class VersionAlreadyPublished(Exception):
    """AC-002-09: the version exists but is already published -- publishing
    (or mutating) it again is rejected, not silently re-applied.
    """


@dataclass(frozen=True)
class GraphVersion:
    version_iri: str
    semver: str
    status: str
    created_at: datetime
    published_at: datetime | None
    actor_iri: str
    workspace_id: str


@dataclass(frozen=True)
class VersionPage:
    versions: list[GraphVersion]
    total: int


@dataclass(frozen=True)
class Page:
    """Bundles `page`/`per_page` into one param -- keeps `list_versions`
    under the Law E five-parameter budget now that AC-003-03 added
    `include_drafts`, rather than waiving the check.
    """

    number: int
    size: int


def _row_to_version(row: asyncpg.Record, *, version_iri: str) -> GraphVersion:
    return GraphVersion(
        version_iri=version_iri,
        semver=str(row["semver"]),
        status=str(row["status"]),
        created_at=row["created_at"],
        published_at=row["published_at"],
        actor_iri=str(row["actor_iri"]),
        workspace_id=str(row["workspace_id"]),
    )


async def mint_version(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    workspace_id: str,
    named_graph_iri: str,
    actor_iri: str,
) -> tuple[str, str]:
    """Returns `(version_iri, semver)` for the next version of the given
    workspace's working graph, recording it as a *draft* in `graph_versions`.
    """
    # False positive: SQL is a static literal; the f-string builds the advisory-lock
    # key bound as positional parameter $1, never interpolated into query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", f"{tenant_id}:{workspace_id}")

    row = await conn.fetchrow(
        "SELECT semver FROM graph_versions WHERE tenant_id = $1 AND workspace_id = $2 "
        "ORDER BY created_at DESC LIMIT 1",
        tenant_id,
        workspace_id,
    )
    semver = _INITIAL_SEMVER if row is None else _bump_patch(str(row["semver"]))
    version_iri = f"{named_graph_iri}:v{semver}"

    # False positive: SQL is a static literal; all values are bound positional
    # parameters ($1..$5), never interpolated into query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "INSERT INTO graph_versions (tenant_id, workspace_id, semver, version_iri, actor_iri) "
        "VALUES ($1, $2, $3, $4, $5)",
        tenant_id,
        workspace_id,
        semver,
        version_iri,
        actor_iri,
    )
    return version_iri, semver


async def get_version(
    conn: asyncpg.Connection, *, tenant_id: str, version_iri: str
) -> GraphVersion | None:
    row = await conn.fetchrow(
        "SELECT semver, status, created_at, published_at, actor_iri, workspace_id "
        "FROM graph_versions WHERE tenant_id = $1 AND version_iri = $2",
        tenant_id,
        version_iri,
    )
    return None if row is None else _row_to_version(row, version_iri=version_iri)


async def list_versions(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    workspace_id: str,
    page: Page,
    include_drafts: bool = True,
) -> VersionPage:
    """AC-002-11: paginated, newest-first. AC-003-03: the router computes
    `include_drafts` from the caller's real RBAC role (author+ only) --
    this function just applies whichever of two fixed, static queries that
    decision picks, never string-building a clause from caller input.
    """
    if include_drafts:
        list_query = (
            "SELECT semver, status, created_at, published_at, actor_iri, workspace_id, "
            "version_iri FROM graph_versions WHERE tenant_id = $1 AND workspace_id = $2 "
            "ORDER BY created_at DESC LIMIT $3 OFFSET $4"
        )
        count_query = (
            "SELECT COUNT(*) AS total FROM graph_versions "
            "WHERE tenant_id = $1 AND workspace_id = $2"
        )
    else:
        list_query = (
            "SELECT semver, status, created_at, published_at, actor_iri, workspace_id, "
            "version_iri FROM graph_versions "
            "WHERE tenant_id = $1 AND workspace_id = $2 AND status != 'draft' "
            "ORDER BY created_at DESC LIMIT $3 OFFSET $4"
        )
        count_query = (
            "SELECT COUNT(*) AS total FROM graph_versions "
            "WHERE tenant_id = $1 AND workspace_id = $2 AND status != 'draft'"
        )

    offset = (page.number - 1) * page.size
    rows = await conn.fetch(list_query, tenant_id, workspace_id, page.size, offset)
    total_row = await conn.fetchrow(count_query, tenant_id, workspace_id)
    versions = [_row_to_version(row, version_iri=str(row["version_iri"])) for row in rows]
    return VersionPage(versions=versions, total=int(total_row["total"]) if total_row else 0)


async def publish_version(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, version_iri: str
) -> GraphVersion:
    """AC-002-07: draft -> published, immutable thereafter.

    The `UPDATE ... WHERE status = 'draft'` is the whole race guard: two
    concurrent publish calls can only ever have one of them match a row (the
    first winner flips status away from 'draft'), so no advisory lock is
    needed here the way `mint_version` needs one. A zero-row result means
    either the version doesn't exist or it's already published -- `get_version`
    disambiguates which, for the right exception/404-vs-405 at the router.
    """
    row = await conn.fetchrow(
        "UPDATE graph_versions SET status = 'published', published_at = now() "
        "WHERE tenant_id = $1 AND workspace_id = $2 AND version_iri = $3 AND status = 'draft' "
        "RETURNING semver, status, created_at, published_at, actor_iri, workspace_id",
        tenant_id,
        workspace_id,
        version_iri,
    )
    if row is not None:
        return _row_to_version(row, version_iri=version_iri)

    existing = await get_version(conn, tenant_id=tenant_id, version_iri=version_iri)
    if existing is None:
        raise VersionNotFound(version_iri)
    raise VersionAlreadyPublished(version_iri)


async def resolve_version(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, version: str
) -> str:
    """AC-002-08: `?version=latest` resolves to the newest *published*
    version_iri, never a draft. Any other value passes through unchanged --
    existence is the caller's job (e.g. a 404 on read/diff).
    """
    if version != "latest":
        return version

    row = await conn.fetchrow(
        "SELECT version_iri FROM graph_versions "
        "WHERE tenant_id = $1 AND workspace_id = $2 AND status = 'published' "
        "ORDER BY created_at DESC LIMIT 1",
        tenant_id,
        workspace_id,
    )
    if row is None:
        raise VersionNotFound("latest")
    return str(row["version_iri"])
