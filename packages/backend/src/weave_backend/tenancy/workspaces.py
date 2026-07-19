"""AC-1: workspace creation, minting a named-graph IRI atomically with the row."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import asyncpg
from pydantic import BaseModel


class WorkspaceSlugTaken(Exception):
    """Raised when a (tenant_id, slug) pair already exists."""


class Workspace(BaseModel):
    id: str
    slug: str
    display_name: str
    named_graph_iri: str
    #: SE1 (docs/design/remediation-2-api-gaps.md): `None` until an admin
    #: sets one via `update_workspace_description` -- no default copy.
    #: Defaults to `None` so the pre-existing construction call sites (seed
    #: data, other routers' test fixtures) that predate this column don't
    #: all need a mechanical `description=None` added.
    description: str | None = None
    created_at: datetime


def _row_to_workspace(row: asyncpg.Record) -> Workspace:
    return Workspace(
        id=str(row["id"]),
        slug=row["slug"],
        display_name=row["display_name"],
        named_graph_iri=row["named_graph_iri"],
        description=row["description"],
        created_at=row["created_at"],
    )


async def create_workspace(
    conn: asyncpg.Connection, *, tenant_id: str, slug: str, display_name: str
) -> Workspace:
    """Insert a new workspace, minting its named-graph IRI from the row's own
    id in the same statement/transaction as the insert (no separate
    "reserve an id then build the IRI" step -- one atomic write).
    """
    workspace_id = uuid4()
    named_graph_iri = f"urn:weave:tenant:{tenant_id}:ws:{workspace_id}"
    try:
        # False positive: the SQL is a static literal; every value is bound as a
        # positional parameter ($1..$5), never interpolated into the query text.
        # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
        row = await conn.fetchrow(
            """
            INSERT INTO workspaces (id, tenant_id, slug, display_name, named_graph_iri)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, slug, display_name, named_graph_iri, description, created_at
            """,
            workspace_id,
            tenant_id,
            slug,
            display_name,
            named_graph_iri,
        )
    except asyncpg.UniqueViolationError as exc:
        raise WorkspaceSlugTaken(slug) from exc
    return _row_to_workspace(row)


async def get_workspace(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> Workspace | None:
    # False positive: static literal SQL; tenant_id/workspace_id are bound as
    # positional parameters ($1/$2), never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        SELECT id, slug, display_name, named_graph_iri, description, created_at
        FROM workspaces WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        workspace_id,
    )
    if row is None:
        return None
    return _row_to_workspace(row)


async def get_workspace_by_slug(
    conn: asyncpg.Connection, *, tenant_id: str, slug: str
) -> Workspace | None:
    """TASK-004: canonical-template lookup keys off `(tenant_id, slug)`'s
    existing unique constraint rather than a new tracking table -- a
    workspace already IS the tenant-local pointer.
    """
    # False positive: static literal SQL; tenant_id/slug are bound as
    # positional parameters ($1/$2), never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        SELECT id, slug, display_name, named_graph_iri, description, created_at
        FROM workspaces WHERE tenant_id = $1 AND slug = $2
        """,
        tenant_id,
        slug,
    )
    if row is None:
        return None
    return _row_to_workspace(row)


async def list_workspaces(conn: asyncpg.Connection, *, tenant_id: str) -> list[Workspace]:
    # False positive: static literal SQL; tenant_id is bound as a positional
    # parameter ($1), never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    rows = await conn.fetch(
        """
        SELECT id, slug, display_name, named_graph_iri, description, created_at
        FROM workspaces WHERE tenant_id = $1 ORDER BY created_at
        """,
        tenant_id,
    )
    return [_row_to_workspace(row) for row in rows]


async def update_workspace_description(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, description: str
) -> Workspace | None:
    """SE1 (docs/design/remediation-2-api-gaps.md): tenant-admin-gated write
    (RBAC enforced by the router, `require_tenant_admin`) -- `None` when no
    row matches `(tenant_id, id)`, so the router can 404 rather than fabricate
    a response for a foreign/nonexistent workspace.
    """
    # False positive: static literal SQL; description/tenant_id/workspace_id
    # are bound as positional parameters ($1..$3), never interpolated.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        """
        UPDATE workspaces SET description = $1
        WHERE tenant_id = $2 AND id = $3
        RETURNING id, slug, display_name, named_graph_iri, description, created_at
        """,
        description,
        tenant_id,
        workspace_id,
    )
    if row is None:
        return None
    return _row_to_workspace(row)


async def delete_workspace(conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str) -> None:
    """TASK-005 AC-005-06: best-effort delete of an old blue/green
    workspace. `workspace_members`/`principals` reference this row with the
    default RESTRICT `ON DELETE`, so this commonly raises
    `asyncpg.ForeignKeyViolationError` -- callers must catch that and log an
    orphan for sweep rather than treat it as a reset failure; the swap that
    matters (the pointer flip) has already committed by the time this runs.
    """
    # False positive: static literal SQL; tenant_id/workspace_id are bound
    # as positional parameters ($1/$2), never interpolated into the query text.
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        "DELETE FROM workspaces WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        workspace_id,
    )
