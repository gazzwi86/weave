"""PLAT-AUDIT-1: every tenancy/settings/billing/identity mutation emits an
audit event through this seam. `HashChainAuditEmitter` is the real
hash-chained, ed25519-signed, append-only implementation -- existing call
sites (tenancy/identity/billing/settings/search/notifications routers)
construct the same `AuditEvent` shape unchanged; only this module and the
underlying table (`audit_entries`, migration 0005) changed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

import asyncpg

from weave_backend.audit.chain import ZERO_HASH, PendingEntry, build_entry
from weave_backend.audit.diff_storage import cap_diff_summary
from weave_backend.audit.notify import SecurityEventContext, notify_tenant_admins_of_security_event
from weave_backend.audit.signing_key import get_signing_key


@dataclass(frozen=True)
class AuditEvent:
    tenant_id: str
    event_type: str
    actor_iri: str
    subject_iri: str
    payload: dict[str, Any] = field(default_factory=dict)
    #: Which engine emitted the event (Constitution/Build/Events/Platform).
    #: Defaults to "platform" -- every existing call site predates
    #: PLAT-AUDIT-1 and constructs `AuditEvent` without this kwarg.
    engine: str = "platform"


class AuditEmitter(Protocol):
    async def emit(self, conn: asyncpg.Connection, event: AuditEvent) -> None: ...


async def _next_seq_and_prev_hash(conn: asyncpg.Connection, tenant_id: str) -> tuple[int, str]:
    row = await conn.fetchrow(
        "SELECT seq, hash FROM audit_entries WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1",
        tenant_id,
    )
    if row is None:
        return 1, ZERO_HASH
    return int(row["seq"]) + 1, str(row["hash"])


class HashChainAuditEmitter:
    async def emit(self, conn: asyncpg.Connection, event: AuditEvent) -> None:
        tenant_id = event.tenant_id

        # Per-tenant critical section: serialises concurrent seq/prev_hash
        # reads+writes for the same tenant within the caller's already-open
        # transaction (ADR-010 -- deviation from the brief's literal nested
        # SERIALIZABLE transaction, which the existing connection pooling
        # pattern doesn't support).
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", tenant_id)

        seq, prev_hash = await _next_seq_and_prev_hash(conn, tenant_id)
        # Canonical ISO-8601 string, stored verbatim (TEXT, not TIMESTAMPTZ)
        # so re-fetching for `verify_chain` reproduces the exact bytes that
        # were hashed at emission time (ADR-010).
        ts = datetime.now(UTC).isoformat()
        diff_summary = await cap_diff_summary(tenant_id, seq, event.payload or None)

        private_key = await get_signing_key()
        pending = PendingEntry(
            ts=ts,
            tenant_id=tenant_id,
            actor_principal_iri=event.actor_iri,
            engine=event.engine,
            event_type=event.event_type,
            target_iri=event.subject_iri,
            diff_summary=diff_summary,
        )
        entry = build_entry(private_key, seq, pending, prev_hash)

        await conn.execute(
            """
            INSERT INTO audit_entries (
                seq, ts, tenant_id, actor_principal_iri, engine, event_type,
                target_iri, diff_summary, prev_hash, hash, signature
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
            """,
            entry.seq,
            entry.ts,
            entry.tenant_id,
            entry.actor_principal_iri,
            entry.engine,
            entry.event_type,
            entry.target_iri,
            json.dumps(entry.diff_summary) if entry.diff_summary is not None else None,
            entry.prev_hash,
            entry.hash,
            entry.signature,
        )

        if event.event_type.startswith("security."):
            await notify_tenant_admins_of_security_event(
                conn,
                SecurityEventContext(
                    tenant_id=tenant_id,
                    event_type=event.event_type,
                    actor_principal_iri=event.actor_iri,
                    target_iri=event.subject_iri,
                    audit_seq=seq,
                ),
            )


default_audit_emitter: AuditEmitter = HashChainAuditEmitter()
