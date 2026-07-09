"""TASK-010: `external_bindings` repo layer -- instance-handle references
into PLAT-CONNECTOR-1 connector instances (space/board/project key), never
the connector credentials themselves.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import asyncpg


@dataclass(frozen=True)
class NewBinding:
    """Grouped to satisfy Law E's 5-parameter cap (mirrors `briefs/store.py`'s
    `NewBrief`).
    """

    project_iri: str
    system: str
    connector_ref: str
    space_ref: str
    created_by: str


@dataclass(frozen=True)
class Binding:
    binding_id: str
    project_iri: str
    system: str
    connector_ref: str
    space_ref: str
    created_by: str
    created_at: datetime


def _from_row(row: asyncpg.Record) -> Binding:
    return Binding(
        binding_id=str(row["binding_id"]),
        project_iri=row["project_iri"],
        system=row["system"],
        connector_ref=row["connector_ref"],
        space_ref=row["space_ref"],
        created_by=row["created_by"],
        created_at=row["created_at"],
    )


async def get_all(conn: asyncpg.Connection, *, tenant_id: str, project_iri: str) -> list[Binding]:
    """All external bindings for a project, oldest-created first."""
    rows = await conn.fetch(
        "SELECT binding_id, project_iri, system, connector_ref, space_ref,"
        " created_by, created_at FROM external_bindings"
        " WHERE tenant_id = $1 AND project_iri = $2 ORDER BY created_at",
        tenant_id,
        project_iri,
    )
    return [_from_row(row) for row in rows]


async def put(conn: asyncpg.Connection, *, tenant_id: str, binding: NewBinding) -> Binding:
    """Create a binding. `(tenant_id, project_iri, system, space_ref)` is
    UNIQUE -- one binding per target system+space per project; the DB
    constraint is the enforcement backstop (AC-5).
    """
    row = await conn.fetchrow(
        """
        INSERT INTO external_bindings
            (tenant_id, project_iri, system, connector_ref, space_ref, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING binding_id, project_iri, system, connector_ref, space_ref,
            created_by, created_at
        """,
        tenant_id,
        binding.project_iri,
        binding.system,
        binding.connector_ref,
        binding.space_ref,
        binding.created_by,
    )
    return _from_row(row)


async def delete(conn: asyncpg.Connection, *, tenant_id: str, binding_id: str) -> None:
    """Remove a binding. No-op if the row does not exist."""
    await conn.execute(
        "DELETE FROM external_bindings WHERE tenant_id = $1 AND binding_id = $2",
        tenant_id,
        binding_id,
    )
