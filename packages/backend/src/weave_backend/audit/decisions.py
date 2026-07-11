"""AC-1/AC-2/AC-6/AC-7/AC-8 (TASK-020, build-engine EPIC-007): the Decision
Log's read view over PLAT-AUDIT-1. Never a copy -- every call queries
`audit_entries` directly (same table `listing.py` reads for the tenant-admin
`/api/audit` viewer), scoped to `engine='build' AND target_iri=<project_iri>`.

`_DECISION_PATTERNS`/`_TASK_UPDATE_PATTERNS` classify real build-engine
`event_type` values (grepped from every `engine="build"` emit call site --
this codebase mostly uses snake_case, not the task brief's illustrative
`hitl.*`/`task.*` dotted namespace) into the three UI chips. `classify_kind`
(the row chip, AC-7) and `list_decisions`' server-side filter (AC-8) read
the exact same two pattern tuples, so a row's chip and the active filter
chip can never disagree -- `system` is not its own list, it's the logical
complement of the other two (Design Decisions in the task brief).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from fnmatch import fnmatch
from typing import Any

import asyncpg

# Patterns ending "_" are prefixes (ceremony.py's `f"gate_result_{gate_kind}"`
# is dynamic -- "dor"/"dod"/"preflight"/"brand"/... aren't a fixed, safely
# enumerable set); everything else is an exact match. One string list feeds
# both `classify_kind` (fnmatch, '%'->'*') and the SQL `LIKE ANY` query
# below (native '%') -- no second copy to drift.
_DECISION_PATTERNS: tuple[str, ...] = (
    "gate_result_%",
    "ceremony_approved",
    "hitl_response",
    "spec_transition",
    "brief_generated",
    "generation_complete",
    "agent_result",
    "secret_scan_fail",
    "model_routing_miss",
)
_TASK_UPDATE_PATTERNS: tuple[str, ...] = (
    "write_back_%",
    "repo_bootstrapped",
    "rich_scaffold_applied",
)


class AuditUnavailable(Exception):
    """Raised when PLAT-AUDIT-1 (the `audit_entries` table) is unreachable.
    Mirrors the `(OSError, asyncpg.PostgresError, TimeoutError)` catch tuple
    `build/hitl.py`'s `default_audit_health_check` already uses for the same
    failure class. `routers/decisions.py` catches this -- and only this --
    to map to a 503 (AC-2); a failure in an unrelated query (e.g. the
    project lookup) is never mislabelled as an audit outage.
    """


@dataclass(frozen=True)
class DecisionRecord:
    seq: int
    ts: str
    actor_principal_iri: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None
    kind: str


@dataclass(frozen=True)
class DecisionPage:
    entries: list[DecisionRecord]
    next_cursor: int | None


@dataclass(frozen=True)
class DecisionQuery:
    """Groups `list_decisions`' filter params under Law E's 5-parameter cap."""

    tenant_id: str
    project_iri: str
    kind: str
    search: str | None
    cursor: int | None
    limit: int = 50


def _matches_any(event_type: str, patterns: tuple[str, ...]) -> bool:
    return any(fnmatch(event_type, p.replace("%", "*")) for p in patterns)


def classify_kind(event_type: str) -> str:
    """Row-chip classification (AC-7): `decision` / `task_update` /
    `system` (the fallback -- everything not explicitly a decision or a
    task update, e.g. `authz_denied`, config/pin/repo-connect events).
    """
    if _matches_any(event_type, _DECISION_PATTERNS):
        return "decision"
    if _matches_any(event_type, _TASK_UPDATE_PATTERNS):
        return "task_update"
    return "system"


def _kind_query_args(kind: str) -> tuple[list[str] | None, bool]:
    """`(patterns, exclude)` for the SQL filter (AC-8). `None` patterns
    means "no event_type filter" (`kind="all"`). `system` reuses the other
    two buckets' patterns with `exclude=True` -- the complement, not a
    third list -- so it can never drift from what `classify_kind` calls
    `decision`/`task_update`.
    """
    if kind == "decision":
        return list(_DECISION_PATTERNS), False
    if kind == "task_update":
        return list(_TASK_UPDATE_PATTERNS), False
    if kind == "system":
        return list(_DECISION_PATTERNS) + list(_TASK_UPDATE_PATTERNS), True
    return None, False


def _row_to_record(row: asyncpg.Record) -> DecisionRecord:
    event_type = row["event_type"]
    return DecisionRecord(
        seq=row["seq"],
        ts=row["ts"],
        actor_principal_iri=row["actor_principal_iri"],
        event_type=event_type,
        target_iri=row["target_iri"],
        diff_summary=json.loads(row["diff_summary"]) if row["diff_summary"] is not None else None,
        kind=classify_kind(event_type),
    )


async def list_decisions(conn: asyncpg.Connection, query: DecisionQuery) -> DecisionPage:
    """AC-1/AC-6/AC-8: one project's build-engine audit trail, most-recent
    first, seq-cursor paginated (append-only log => stable, unlike OFFSET).
    Fetches `limit + 1` rows to detect a next page without a second COUNT
    query -- an audit log has no stable total worth paying for (AC-6: first
    page ≤ 1s, not total log size).
    """
    patterns, exclude = _kind_query_args(query.kind)
    try:
        rows = await conn.fetch(
            """
            SELECT seq, ts, actor_principal_iri, event_type, target_iri, diff_summary
            FROM audit_entries
            WHERE tenant_id = $1 AND engine = 'build' AND target_iri = $2
              AND ($3::bigint IS NULL OR seq < $3)
              AND ($4::text IS NULL OR event_type ILIKE '%' || $4 || '%'
                   OR diff_summary::text ILIKE '%' || $4 || '%')
              AND (
                $5::text[] IS NULL
                OR (NOT $6 AND event_type LIKE ANY($5::text[]))
                OR ($6 AND NOT (event_type LIKE ANY($5::text[])))
              )
            ORDER BY seq DESC
            LIMIT $7
            """,
            query.tenant_id,
            query.project_iri,
            query.cursor,
            query.search,
            patterns,
            exclude,
            query.limit + 1,
        )
    except (OSError, asyncpg.PostgresError, TimeoutError) as exc:
        raise AuditUnavailable from exc

    records = [_row_to_record(row) for row in rows]
    if len(records) > query.limit:
        page = records[: query.limit]
        return DecisionPage(entries=page, next_cursor=page[-1].seq)
    return DecisionPage(entries=records, next_cursor=None)
