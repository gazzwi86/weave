"""Durable audit outbox (ADR-002, AC-002-04).

A mutation commit enqueues its PLAT-AUDIT-1 event as a plain, same-
transaction Postgres INSERT (cheap -- it can only fail if Postgres itself
is down, in which case the whole mutation is already failing) instead of
calling the real hash-chain emitter inline. Real delivery --
`HashChainAuditEmitter`'s advisory-lock + sign + insert -- happens
afterwards, in `flush_pending`, called from a connection/transaction
separate from the mutation's own. A per-row savepoint isolates one row's
emit failure from the rest of the flush: nothing is ever dropped, and a
failing row never blocks -- or gets blocked by -- its neighbours.
"""

from __future__ import annotations

import json
import logging

import asyncpg

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter

log = logging.getLogger(__name__)


async def enqueue(conn: asyncpg.Connection, event: AuditEvent) -> None:
    await conn.execute(
        "INSERT INTO audit_outbox (tenant_id, event_type, actor_iri, subject_iri, engine, payload) "
        "VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
        event.tenant_id,
        event.event_type,
        event.actor_iri,
        event.subject_iri,
        event.engine,
        json.dumps(event.payload),
    )


async def flush_pending(
    conn: asyncpg.Connection, tenant_id: str, *, emitter: AuditEmitter = default_audit_emitter
) -> int:
    """Delivers every pending row for `tenant_id` via `emitter`, marking each
    delivered on success. A row whose emit raises stays pending for the next
    flush (AC-002-04) -- never dropped, never allowed to block the rest.

    Returns the number of rows delivered this call.
    """
    rows = await conn.fetch(
        "SELECT id, event_type, actor_iri, subject_iri, engine, payload "
        "FROM audit_outbox WHERE tenant_id = $1 AND delivered_at IS NULL ORDER BY created_at",
        tenant_id,
    )
    delivered = 0
    for row in rows:
        event = AuditEvent(
            tenant_id=tenant_id,
            event_type=str(row["event_type"]),
            actor_iri=str(row["actor_iri"]),
            subject_iri=str(row["subject_iri"]),
            engine=str(row["engine"]),
            payload=json.loads(row["payload"]),
        )
        try:
            async with conn.transaction():  # per-row savepoint
                await emitter.emit(conn, event)
                await conn.execute(
                    "UPDATE audit_outbox SET delivered_at = now() WHERE id = $1", row["id"]
                )
        except Exception:
            # AC-002-04: sink failure must never propagate (mutation already
            # committed) or drop the event (it stays pending for next flush).
            log.warning("audit outbox delivery failed, will retry: id=%s", row["id"], exc_info=True)
            continue
        delivered += 1
    return delivered
