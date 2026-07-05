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


async def list_entries(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    page: int,
    per_page: int,
    event_type: str | None,
) -> AuditEntryPage:
    # A static query with a `$2::text IS NULL OR ...` guard (rather than
    # conditionally interpolating a WHERE clause) keeps the SQL fixed and
    # entirely parameterised -- no per-call string construction to review.
    rows = await conn.fetch(
        """
        SELECT seq, ts, tenant_id, actor_principal_iri, engine, event_type,
               target_iri, diff_summary, prev_hash, hash, signature
        FROM audit_entries
        WHERE tenant_id = $1 AND ($2::text IS NULL OR event_type = $2)
        ORDER BY seq DESC
        LIMIT $3 OFFSET $4
        """,
        tenant_id,
        event_type,
        per_page,
        (page - 1) * per_page,
    )
    total_row = await conn.fetchrow(
        "SELECT COUNT(*) AS c FROM audit_entries"
        " WHERE tenant_id = $1 AND ($2::text IS NULL OR event_type = $2)",
        tenant_id,
        event_type,
    )
    total = int(total_row["c"]) if total_row is not None else 0
    return AuditEntryPage(entries=[_row_to_record(row) for row in rows], total=total)
