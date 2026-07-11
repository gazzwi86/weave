"""CE-EVENT-1 beta transport (ADR-008, m2-delta.md §5): transactional
change-feed writer + reader helpers, hooked into CE-WRITE-1's `_commit`
(success, same transaction) and the SHACL-violation branch (its own
transaction) in `operations/pipeline.py` -- the only two callers, per the
task brief's "insert goes once, no per-router emission" hint.

Design note: a batch is one commit -> one event (FR-015 AC), so
`change_type`/`entity_iri` are derived from the FIRST operation in the
batch, not an exhaustive per-op ledger -- this feed is a poke to re-diff
via CE-READ-1, not the system of record (PLAT-AUDIT-1 already is that).
`change_type` is a uniform verb-prefix mapping across node and edge ops.

Every CE-WRITE-1 apply call mints a *draft* `graph_versions` row
(`versioning.mint_version`) -- so `version_iri` on events this module
writes is always `None` (AC-008-03's "real IRI on publish events" clause
describes a future publish-side hook, out of this task's scope, which is
limited to the CE-WRITE-1 commit path).
"""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from weave_backend.schemas.events import ChangeType
from weave_backend.schemas.operations import (
    AddEdgeOp,
    AddNodeOp,
    DeleteEdgeOp,
    DeleteNodeOp,
    Op,
    UpdateNodeOp,
)
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import company_iri

#: PLAT-SETTINGS-1 key (AC-008-05: tunable, never hardcoded 30).
RETENTION_SETTING_KEY = "events.change_feed.retention_days"
DEFAULT_RETENTION_DAYS = 30

_OP_CHANGE_TYPE: dict[str, ChangeType] = {
    "add_node": "added",
    "add_edge": "added",
    "update_node": "updated",
    "delete_node": "deleted",
    "delete_edge": "deleted",
}


def op_change_type(op: Op) -> ChangeType:
    """AC-008-03: maps a batch operation's `op` discriminator to the
    feed's `change_type` -- uniform verb prefix, node and edge ops alike.
    """
    return _OP_CHANGE_TYPE[op.op]


def op_entity_iri(op: Op, ref_map: dict[str, str]) -> str:
    """Resolves an op's subject IRI through the batch's `ref_map` -- new
    nodes only carry a local `ref` until `graph_ops.apply_operations`
    resolves it to a real IRI.
    """
    if isinstance(op, AddNodeOp):
        return ref_map.get(op.ref, op.ref)
    if isinstance(op, (UpdateNodeOp, DeleteNodeOp)):
        return op.iri
    if isinstance(op, AddEdgeOp):
        return ref_map.get(op.subject_ref, op.subject_ref)
    if isinstance(op, DeleteEdgeOp):
        return op.subject
    raise AssertionError(f"unhandled op type: {op!r}")  # pragma: no cover


async def _latest_published_version_iri(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str
) -> str | None:
    row = await conn.fetchrow(
        "SELECT version_iri FROM graph_versions "
        "WHERE tenant_id = $1 AND workspace_id = $2 AND status = 'published' "
        "ORDER BY created_at DESC LIMIT 1",
        tenant_id,
        workspace_id,
    )
    return str(row["version_iri"]) if row is not None else None


@dataclass(frozen=True)
class CommitEvent:
    """AC-008-03's contract shape, minus `seq`/`ts`/`last_published_version`
    (server-assigned). Bundled as one param -- see `record_commit_event`
    (Law E: cap function params at 5).
    """

    tenant_id: str
    workspace_id: str
    change_type: ChangeType
    entity_iri: str
    version_iri: str | None
    actor: str


async def record_commit_event(conn: asyncpg.Connection, event: CommitEvent) -> None:
    """AC-008-01/-02/-03: one row. Caller chooses which connection/
    transaction to pass -- this function never opens its own, so the
    success path (same-txn) and the constraint-violated path (own txn)
    share one insert.
    """
    last_published = await _latest_published_version_iri(
        conn, tenant_id=event.tenant_id, workspace_id=event.workspace_id
    )
    await conn.execute(
        "INSERT INTO graph_change_events "
        "(tenant_id, change_type, entity_iri, version_iri, last_published_version, actor) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        event.tenant_id,
        event.change_type,
        event.entity_iri,
        event.version_iri,
        last_published,
        event.actor,
    )


async def retention_days(conn: asyncpg.Connection, *, tenant_id: str) -> int:
    """AC-008-05: PLAT-SETTINGS-1-tunable retention window, default 30d."""
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=RETENTION_SETTING_KEY,
            context_iri=company_iri(tenant_id),
        )
    except SettingNotFound:
        return DEFAULT_RETENTION_DAYS
    return int(resolved.value)


def _is_cursor_aged_out(since_seq: int, newest_expired_seq: int | None) -> bool:
    """AC-008-05: a cursor is aged out only if a row it should have seen
    (`seq > since_seq`) has fallen out of the retention window. An empty
    tenant, or a `since_seq` already past every expired row, is never
    410 -- never a silent empty page standing in for real data loss.
    """
    return newest_expired_seq is not None and since_seq < newest_expired_seq


@dataclass(frozen=True)
class EventPage:
    events: list[asyncpg.Record]
    latest_seq: int
    aged_out: bool


async def read_events(
    conn: asyncpg.Connection, *, tenant_id: str, since_seq: int, limit: int
) -> EventPage:
    """AC-008-04/-05: ordered page of `seq > since_seq` events plus
    `latest_seq`, or `aged_out=True` when the cursor predates the
    retention window (caller maps that to 410).
    """
    days = await retention_days(conn, tenant_id=tenant_id)
    bounds = await conn.fetchrow(
        "SELECT MAX(seq) AS latest_seq, "
        "MAX(seq) FILTER (WHERE ts <= now() - make_interval(days => $1)) AS newest_expired_seq "
        "FROM graph_change_events WHERE tenant_id = $2",
        days,
        tenant_id,
    )
    latest_seq = int(bounds["latest_seq"]) if bounds["latest_seq"] is not None else 0
    newest_expired_seq = (
        int(bounds["newest_expired_seq"]) if bounds["newest_expired_seq"] is not None else None
    )
    if _is_cursor_aged_out(since_seq, newest_expired_seq):
        return EventPage(events=[], latest_seq=latest_seq, aged_out=True)

    rows = await conn.fetch(
        "SELECT seq, change_type, entity_iri, version_iri, last_published_version, actor, ts "
        "FROM graph_change_events "
        "WHERE tenant_id = $1 AND seq > $2 AND ts > now() - make_interval(days => $3) "
        "ORDER BY seq ASC LIMIT $4",
        tenant_id,
        since_seq,
        days,
        limit,
    )
    return EventPage(events=list(rows), latest_seq=latest_seq, aged_out=False)
