"""TASK-010: `project_contributors` repo layer. Admin/editor roles only --
readers have no row here (read access is tenant membership, PLAT-IDENTITY-1 +
PLAT-SETTINGS-1 precedence resolves the admin-owner overlay, not this table).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import asyncpg


@dataclass(frozen=True)
class NewContributor:
    """Grouped to satisfy Law E's 5-parameter cap (mirrors `briefs/store.py`'s
    `NewBrief`).
    """

    project_iri: str
    principal_iri: str
    role: str
    added_by: str


@dataclass(frozen=True)
class Contributor:
    project_iri: str
    principal_iri: str
    role: str
    added_by: str
    added_at: datetime


#: TASK-014 AC-1: the "owner" grid derivation (ADR-014 point 4) -- the
#: earliest-added `admin` contributor per project. Exposed as a joinable SQL
#: fragment (not a Python function) so callers outside `pm/` -- `projects/
#: grid.py`'s single grid query -- can compose it into one indexed query
#: without naming `project_contributors` in their own raw SQL, which
#: `test_pm_static_no_raw_sql.py`'s repo-layer-only guard forbids. Assumes
#: the caller's outer query aliases its `projects` row as `p`.
OWNER_LATERAL_SQL = """
    LEFT JOIN LATERAL (
        SELECT principal_iri FROM project_contributors pc
        WHERE pc.tenant_id = p.tenant_id AND pc.project_iri = p.project_iri
            AND pc.role = 'admin'
        ORDER BY pc.added_at ASC LIMIT 1
    ) owner ON true
"""


def _from_row(row: asyncpg.Record) -> Contributor:
    return Contributor(
        project_iri=row["project_iri"],
        principal_iri=row["principal_iri"],
        role=row["role"],
        added_by=row["added_by"],
        added_at=row["added_at"],
    )


async def get_all(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> list[Contributor]:
    """All contributors for a project, oldest-added first."""
    rows = await conn.fetch(
        "SELECT project_iri, principal_iri, role, added_by, added_at"
        " FROM project_contributors WHERE tenant_id = $1 AND project_iri = $2"
        " ORDER BY added_at",
        tenant_id,
        project_iri,
    )
    return [_from_row(row) for row in rows]


async def upsert(
    conn: asyncpg.Connection, *, tenant_id: str, contributor: NewContributor
) -> Contributor:
    """Insert or update a contributor's role. `role` must be 'admin' or
    'editor' -- the DB CHECK constraint is the enforcement backstop.
    """
    row = await conn.fetchrow(
        """
        INSERT INTO project_contributors
            (tenant_id, project_iri, principal_iri, role, added_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, project_iri, principal_iri)
        DO UPDATE SET role = EXCLUDED.role, added_by = EXCLUDED.added_by
        RETURNING project_iri, principal_iri, role, added_by, added_at
        """,
        tenant_id,
        contributor.project_iri,
        contributor.principal_iri,
        contributor.role,
        contributor.added_by,
    )
    return _from_row(row)


async def get_role(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, principal_iri: str
) -> str | None:
    """TASK-011: single indexed lookup on `(tenant_id, project_iri,
    principal_iri)` -- the same key `upsert`'s `ON CONFLICT` targets. No
    caching: removing a contributor revokes access on the very next request.
    """
    row = await conn.fetchrow(
        "SELECT role FROM project_contributors"
        " WHERE tenant_id = $1 AND project_iri = $2 AND principal_iri = $3",
        tenant_id,
        project_iri,
        principal_iri,
    )
    return str(row["role"]) if row is not None else None


async def delete(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, principal_iri: str
) -> None:
    """Remove a contributor. No-op if the row does not exist."""
    await conn.execute(
        "DELETE FROM project_contributors"
        " WHERE tenant_id = $1 AND project_iri = $2 AND principal_iri = $3",
        tenant_id,
        project_iri,
        principal_iri,
    )
