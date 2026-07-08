"""AC-7: `GET /api/audit/compliance` aggregation. `diff_summary` never
appears in this response shape for anyone -- redaction is structural (the
shape has no field for it), not a role branch, so there's nothing for a
non-admin caller to leak.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import asyncpg

from weave_backend.audit.verify import verify_chain
from weave_backend.billing.period import current_period

_TOP_ACTORS_LIMIT = 5

# CE-WRITE-1 is the only mutation entry point and SHACL-validates every write,
# so the published graph is conformant by construction -- these event types
# are the compliance hub's actual signal: validation activity, not violations.
_SHACL_VALIDATED_EVENTS = {"operations.applied", "write_back_success"}
_SHACL_REJECTED_EVENT = "write_back_fail_shacl"


@dataclass(frozen=True)
class ActorCount:
    principal_iri: str
    event_count: int


@dataclass(frozen=True)
class ComplianceSummary:
    period: str
    chain_status: str
    entries_checked: int
    first_broken_seq: int | None
    by_event_category: dict[str, int]
    top_actors: list[ActorCount]
    shacl_validated: int
    shacl_rejections: int


def _event_category(event_type: str) -> str:
    return event_type.split(".", 1)[0]


def _period_bounds(period: str) -> tuple[str, str]:
    """Month start (inclusive) / next-month start (exclusive), UTC, as
    ISO8601 strings -- `audit_entries.ts` is TEXT (see migration
    0005_audit_chain.sql), written via `datetime.now(UTC).isoformat()`
    (`emitter.py`), so bounds must be the same string form for `>=`/`<` to
    compare correctly rather than failing at the asyncpg type boundary.
    """
    year, month = (int(part) for part in period.split("-"))
    start = datetime(year, month, 1, tzinfo=UTC)
    end = (
        datetime(year + 1, 1, 1, tzinfo=UTC)
        if month == 12
        else datetime(year, month + 1, 1, tzinfo=UTC)
    )
    return start.isoformat(), end.isoformat()


async def _fetch_event_type_counts(
    conn: asyncpg.Connection, tenant_id: str, period: str | None
) -> list[asyncpg.Record]:
    if period is None:
        rows: list[asyncpg.Record] = await conn.fetch(
            "SELECT event_type, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
            " GROUP BY event_type",
            tenant_id,
        )
        return rows
    start, end = _period_bounds(period)
    period_rows: list[asyncpg.Record] = await conn.fetch(
        "SELECT event_type, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
        " AND ts >= $2 AND ts < $3 GROUP BY event_type",
        tenant_id,
        start,
        end,
    )
    return period_rows


async def _fetch_top_actors(
    conn: asyncpg.Connection, tenant_id: str, period: str | None
) -> list[ActorCount]:
    if period is None:
        rows = await conn.fetch(
            "SELECT actor_principal_iri, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
            " GROUP BY actor_principal_iri ORDER BY c DESC LIMIT $2",
            tenant_id,
            _TOP_ACTORS_LIMIT,
        )
    else:
        start, end = _period_bounds(period)
        rows = await conn.fetch(
            "SELECT actor_principal_iri, COUNT(*) AS c FROM audit_entries WHERE tenant_id = $1"
            " AND ts >= $2 AND ts < $3 GROUP BY actor_principal_iri ORDER BY c DESC LIMIT $4",
            tenant_id,
            start,
            end,
            _TOP_ACTORS_LIMIT,
        )
    return [
        ActorCount(principal_iri=row["actor_principal_iri"], event_count=int(row["c"]))
        for row in rows
    ]


def _aggregate_event_types(rows: list[asyncpg.Record]) -> tuple[dict[str, int], int, int]:
    by_event_category: dict[str, int] = {}
    shacl_validated = 0
    shacl_rejections = 0
    for row in rows:
        event_type = row["event_type"]
        count = int(row["c"])
        category = _event_category(event_type)
        by_event_category[category] = by_event_category.get(category, 0) + count
        if event_type in _SHACL_VALIDATED_EVENTS:
            shacl_validated += count
        elif event_type == _SHACL_REJECTED_EVENT:
            shacl_rejections += count
    return by_event_category, shacl_validated, shacl_rejections


async def get_compliance_summary(
    conn: asyncpg.Connection, tenant_id: str, *, period: str | None = None
) -> ComplianceSummary:
    # The hash chain is global, not scoped to a reporting period -- always
    # verify the whole chain regardless of `period`.
    verify_result = await verify_chain(conn, tenant_id)

    event_type_rows = await _fetch_event_type_counts(conn, tenant_id, period)
    by_event_category, shacl_validated, shacl_rejections = _aggregate_event_types(event_type_rows)
    top_actors = await _fetch_top_actors(conn, tenant_id, period)

    return ComplianceSummary(
        period=period if period is not None else current_period(),
        chain_status="valid" if verify_result.valid else "broken",
        entries_checked=verify_result.entries_checked,
        first_broken_seq=verify_result.first_broken_seq,
        by_event_category=by_event_category,
        top_actors=top_actors,
        shacl_validated=shacl_validated,
        shacl_rejections=shacl_rejections,
    )
