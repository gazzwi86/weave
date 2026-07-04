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
    created_at: datetime


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
        row = await conn.fetchrow(  # nosemgrep
            """
            INSERT INTO workspaces (id, tenant_id, slug, display_name, named_graph_iri)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, slug, display_name, named_graph_iri, created_at
            """,
            workspace_id,
            tenant_id,
            slug,
            display_name,
            named_graph_iri,
        )
    except asyncpg.UniqueViolationError as exc:
        raise WorkspaceSlugTaken(slug) from exc
    return Workspace(
        id=str(row["id"]),
        slug=row["slug"],
        display_name=row["display_name"],
        named_graph_iri=row["named_graph_iri"],
        created_at=row["created_at"],
    )


async def get_workspace(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> Workspace | None:
    # False positive: static literal SQL; tenant_id/workspace_id are bound as
    # positional parameters ($1/$2), never interpolated into the query text.
    row = await conn.fetchrow(  # nosemgrep
        """
        SELECT id, slug, display_name, named_graph_iri, created_at
        FROM workspaces WHERE tenant_id = $1 AND id = $2
        """,
        tenant_id,
        workspace_id,
    )
    if row is None:
        return None
    return Workspace(
        id=str(row["id"]),
        slug=row["slug"],
        display_name=row["display_name"],
        named_graph_iri=row["named_graph_iri"],
        created_at=row["created_at"],
    )
