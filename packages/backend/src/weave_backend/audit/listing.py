"""AC-5: paginated, most-recent-first audit entry listing for `GET
/api/audit`. Kept separate from `verify.py`'s full-chain fetch -- listing is
one page at a time, verification always needs the whole ordered chain.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import asyncpg

from weave_backend.audit.chain import AuditEntryRecord


@dataclass(frozen=True)
class AuditEntryPage:
    entries: list[AuditEntryRecord]
    total: int


@dataclass(frozen=True)
class AuditFilters:
    """The seven `PLAT-AUDIT-1` query dimensions (contracts.md), bundled so
    `list_entries` stays within the Law E params budget (<=5)."""

    engine: str | None = None
    event_type: str | None = None
    actor_principal_iri: str | None = None
    target_iri: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    q: str | None = None


def _row_to_record(row: asyncpg.Record) -> AuditEntryRecord:
    return AuditEntryRecord(
        seq=row["seq"],
        ts=row["ts"],
        tenant_id=row["tenant_id"],
        actor_principal_iri=row["actor_principal_iri"],
        engine=row["engine"],
        event_type=row["event_type"],
        target_iri=row["target_iri"],
        diff_summary=json.loads(row["diff_summary"]) if row["diff_summary"] is not None else None,
        prev_hash=row["prev_hash"],
        hash=row["hash"],
        signature=row["signature"],
    )


# A single static WHERE clause with `$n::text IS NULL OR ...` guards (rather
# than conditionally interpolating the clause per call) keeps the SQL fixed
# and entirely parameterised -- no per-call string construction to review.
# Written out in full (not built via an f-string) so a static-analysis SQL-
# injection scan sees only literal query text, never string interpolation.
_LIST_QUERY = """
    SELECT seq, ts, tenant_id, actor_principal_iri, engine, event_type,
           target_iri, diff_summary, prev_hash, hash, signature
    FROM audit_entries
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR engine = $2)
      AND ($3::text IS NULL OR event_type = $3)
      AND ($4::text IS NULL OR actor_principal_iri = $4)
      AND ($5::text IS NULL OR target_iri = $5)
      AND ($6::timestamptz IS NULL OR ts >= $6)
      AND ($7::timestamptz IS NULL OR ts <= $7)
      AND (
        $8::text IS NULL
        OR target_iri ILIKE '%' || $8 || '%'
        OR diff_summary::text ILIKE '%' || $8 || '%'
      )
    ORDER BY seq DESC
    LIMIT $9 OFFSET $10
    """

_COUNT_QUERY = """
    SELECT COUNT(*) AS c
    FROM audit_entries
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR engine = $2)
      AND ($3::text IS NULL OR event_type = $3)
      AND ($4::text IS NULL OR actor_principal_iri = $4)
      AND ($5::text IS NULL OR target_iri = $5)
      AND ($6::timestamptz IS NULL OR ts >= $6)
      AND ($7::timestamptz IS NULL OR ts <= $7)
      AND (
        $8::text IS NULL
        OR target_iri ILIKE '%' || $8 || '%'
        OR diff_summary::text ILIKE '%' || $8 || '%'
      )
    """


async def list_entries(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    page: int,
    per_page: int,
    filters: AuditFilters | None = None,
) -> AuditEntryPage:
    f = filters or AuditFilters()
    filter_args = (
        tenant_id,
        f.engine,
        f.event_type,
        f.actor_principal_iri,
        f.target_iri,
        f.date_from,
        f.date_to,
        f.q,
    )
    rows = await conn.fetch(_LIST_QUERY, *filter_args, per_page, (page - 1) * per_page)
    total_row = await conn.fetchrow(_COUNT_QUERY, *filter_args)
    total = int(total_row["c"]) if total_row is not None else 0
    return AuditEntryPage(entries=[_row_to_record(row) for row in rows], total=total)
