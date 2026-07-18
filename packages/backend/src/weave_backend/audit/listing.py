"""AC-5: paginated, most-recent-first audit entry listing for `GET
/api/audit`. Kept separate from `verify.py`'s full-chain fetch -- listing is
one page at a time, verification always needs the whole ordered chain.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

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
# `r"""..."""` (raw string) is deliberate: a non-raw string reads `ESCAPE
# '\'` as an escaped quote, collapsing it to `ESCAPE ''` -- which disables
# escaping entirely, so a literal `%`/`_` in `q` or the event_type prefix
# would silently wildcard-inject. Raw keeps the single backslash intact.
_LIST_QUERY = r"""
    SELECT seq, ts, tenant_id, actor_principal_iri, engine, event_type,
           target_iri, diff_summary, prev_hash, hash, signature
    FROM audit_entries
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR engine = $2)
      AND ($3::text IS NULL OR event_type = $3)
      AND ($4::text IS NULL OR actor_principal_iri = $4)
      AND ($5::text IS NULL OR target_iri = $5)
      AND ($6::timestamptz IS NULL OR ts::timestamptz >= $6)
      AND ($7::timestamptz IS NULL OR ts::timestamptz <= $7)
      AND (
        $8::text IS NULL
        OR target_iri ILIKE '%' || $8 || '%' ESCAPE '\'
        OR diff_summary::text ILIKE '%' || $8 || '%' ESCAPE '\'
      )
      AND ($9::text IS NULL OR event_type LIKE $9 ESCAPE '\')
    ORDER BY seq DESC
    LIMIT $10 OFFSET $11
    """

_COUNT_QUERY = r"""
    SELECT COUNT(*) AS c
    FROM audit_entries
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR engine = $2)
      AND ($3::text IS NULL OR event_type = $3)
      AND ($4::text IS NULL OR actor_principal_iri = $4)
      AND ($5::text IS NULL OR target_iri = $5)
      AND ($6::timestamptz IS NULL OR ts::timestamptz >= $6)
      AND ($7::timestamptz IS NULL OR ts::timestamptz <= $7)
      AND (
        $8::text IS NULL
        OR target_iri ILIKE '%' || $8 || '%' ESCAPE '\'
        OR diff_summary::text ILIKE '%' || $8 || '%' ESCAPE '\'
      )
      AND ($9::text IS NULL OR event_type LIKE $9 ESCAPE '\')
    """


def _escape_like(value: str) -> str:
    """Escapes LIKE/ILIKE wildcards in a user-supplied value so typing a
    literal `%`/`_` filters for that literal, not an unintended wildcard.
    Backslash first, then the two wildcard chars -- order matters so the
    escape char itself doesn't get re-escaped. Paired with `ESCAPE '\\'` in
    the query."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _optional_escape_like(value: str | None) -> str | None:
    return None if value is None else _escape_like(value)


_PREFIX_SUFFIX = ".*"


def _event_type_clause_values(value: str | None) -> tuple[str | None, str | None]:
    """G4/contracts.md:284-286: `event_type=ce.*` is a prefix match, not
    literal. A value ending in `.*` is split into `(None, escaped_prefix +
    ".%")` for the `LIKE ... ESCAPE '\\'` clause; anything else stays an
    exact match via `(value, None)`. Exactly one of the pair is non-None
    (or both None, unfiltered) -- the SQL ANDs both guards so whichever is
    null is a no-op.
    """
    if value is None:
        return None, None
    if value.endswith(_PREFIX_SUFFIX):
        prefix = value[: -len(_PREFIX_SUFFIX)]
        return None, f"{_escape_like(prefix)}.%"
    return value, None


def _filter_args(tenant_id: str, f: AuditFilters) -> tuple[Any, ...]:
    """Shared positional arg tuple ($1-$9) for `_LIST_QUERY`/`_COUNT_QUERY`
    -- extracted so a future grouped-count query can compose the same
    filter set as `list_entries` without duplicating it."""
    exact_event_type, event_type_prefix = _event_type_clause_values(f.event_type)
    return (
        tenant_id,
        f.engine,
        exact_event_type,
        f.actor_principal_iri,
        f.target_iri,
        f.date_from,
        f.date_to,
        _optional_escape_like(f.q),
        event_type_prefix,
    )


async def list_entries(
    conn: asyncpg.Connection,
    *,
    tenant_id: str,
    page: int,
    per_page: int,
    filters: AuditFilters | None = None,
) -> AuditEntryPage:
    args = _filter_args(tenant_id, filters or AuditFilters())
    rows = await conn.fetch(_LIST_QUERY, *args, per_page, (page - 1) * per_page)
    total_row = await conn.fetchrow(_COUNT_QUERY, *args)
    total = int(total_row["c"]) if total_row is not None else 0
    return AuditEntryPage(entries=[_row_to_record(row) for row in rows], total=total)
