"""PLAT-AUDIT-1 forward contract: every tenancy/settings mutation emits an
audit event through this seam. TASK-009 builds the real hash-chained audit
store; this Postgres-table sink is a placeholder implementation behind the
same `AuditEmitter` protocol, so TASK-009 re-points `default_audit_emitter`
at its implementation without touching any call site.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

import asyncpg


@dataclass(frozen=True)
class AuditEvent:
    tenant_id: str
    event_type: str
    actor_iri: str
    subject_iri: str
    payload: dict[str, Any] = field(default_factory=dict)


class AuditEmitter(Protocol):
    async def emit(self, conn: asyncpg.Connection, event: AuditEvent) -> None: ...


class PostgresAuditEmitter:
    async def emit(self, conn: asyncpg.Connection, event: AuditEvent) -> None:
        await conn.execute(
            """
            INSERT INTO audit_events (tenant_id, event_type, actor_iri, subject_iri, payload)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            event.tenant_id,
            event.event_type,
            event.actor_iri,
            event.subject_iri,
            json.dumps(event.payload),
        )


default_audit_emitter: AuditEmitter = PostgresAuditEmitter()
