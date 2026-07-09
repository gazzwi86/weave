"""AC-1 (TASK-014, build-engine EPIC-002): the projects grid -- a
keyset-paginated list of project cards with a derived lifecycle phase
(ADR-014 point 1/2/3), a derived owner (ADR-014 point 4), and optional
`lifecycle_phase`/`owner`/`search` filters (ADR-014 point 5: no separate
`status` filter -- it's the same axis as `lifecycle_phase`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import asyncpg

from weave_backend.pm.contributors import OWNER_LATERAL_SQL

#: ADR-014 points 1-3: Archived > Live monitoring > Building > Speccing.
_PHASE_CASE = """
    CASE
        WHEN p.archived_at IS NOT NULL THEN 'Archived'
        WHEN p.demo_output_location_ref IS NOT NULL THEN 'Live monitoring'
        WHEN ss.project_iri IS NOT NULL THEN 'Building'
        ELSE 'Speccing'
    END
"""

# S608/B608: every interpolated piece here is a module-level constant
# (`_PHASE_CASE`, `OWNER_LATERAL_SQL`), never a request value -- all real
# query parameters are `$1..$7` placeholders `conn.fetch` binds. Parenthesized
# adjacent-literal concatenation (not one big f-string) so the suppression
# directives below land on the exact reported line without corrupting the
# SQL text.
_GRID_QUERY = (
    "WITH page AS ( "  # noqa: S608  # nosec B608
    "SELECT p.project_iri, p.name, p.created_at, owner.principal_iri AS owner_iri, "
    f"{_PHASE_CASE} AS lifecycle_phase "
    "FROM projects p "
    "LEFT JOIN state_spines ss "
    "ON ss.project_iri = p.project_iri AND ss.tenant_id = p.tenant_id "
    f"{OWNER_LATERAL_SQL} "
    "WHERE p.tenant_id = $1 "
    ") "
    "SELECT * FROM page "
    "WHERE ($2::text IS NULL OR name ILIKE '%' || $2 || '%') "
    "AND ($3::text IS NULL OR lifecycle_phase = $3) "
    "AND ($4::text IS NULL OR owner_iri = $4) "
    "AND ($5::timestamptz IS NULL OR (created_at, project_iri) > ($5, $6)) "
    "ORDER BY created_at, project_iri "
    "LIMIT $7"
)


@dataclass(frozen=True)
class ProjectCard:
    project_iri: str
    name: str
    created_at: datetime
    lifecycle_phase: str
    owner_iri: str | None


@dataclass(frozen=True)
class ProjectGridPage:
    items: list[ProjectCard]
    next_cursor: str | None


@dataclass(frozen=True)
class GridFilters:
    """Grouped to satisfy Law E's 5-parameter cap."""

    lifecycle_phase: str | None = None
    owner_iri: str | None = None
    search: str | None = None
    cursor: str | None = None
    limit: int = 25


def _decode_cursor(cursor: str | None) -> tuple[datetime, str] | None:
    if cursor is None:
        return None
    created_at_raw, project_iri = cursor.split("|", 1)
    return datetime.fromisoformat(created_at_raw), project_iri


def _encode_cursor(created_at: datetime, project_iri: str) -> str:
    return f"{created_at.isoformat()}|{project_iri}"


def _to_card(row: asyncpg.Record) -> ProjectCard:
    return ProjectCard(
        project_iri=row["project_iri"],
        name=row["name"],
        created_at=row["created_at"],
        lifecycle_phase=row["lifecycle_phase"],
        owner_iri=row["owner_iri"],
    )


async def list_projects(
    conn: asyncpg.Connection, *, tenant_id: str, filters: GridFilters
) -> ProjectGridPage:
    """One indexed query -- a LATERAL join for owner and a LEFT JOIN for
    state-spine existence, not a per-row round trip -- no N+1 across the
    page. Keyset pagination on `(created_at, project_iri)`: `project_iri`
    is `projects`' actual primary key, standing in for the task brief's
    `(created_at, id)`.
    """
    after = _decode_cursor(filters.cursor)
    rows = await conn.fetch(
        _GRID_QUERY,
        tenant_id,
        filters.search,
        filters.lifecycle_phase,
        filters.owner_iri,
        after[0] if after else None,
        after[1] if after else "",
        filters.limit + 1,
    )
    has_more = len(rows) > filters.limit
    page_rows = rows[: filters.limit]
    next_cursor = (
        _encode_cursor(page_rows[-1]["created_at"], page_rows[-1]["project_iri"])
        if has_more
        else None
    )
    return ProjectGridPage(items=[_to_card(row) for row in page_rows], next_cursor=next_cursor)
