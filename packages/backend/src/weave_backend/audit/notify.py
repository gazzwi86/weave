"""AC-6's `security.*` -> PLAT-NOTIFY-1 fan-out. Dispatched synchronously on
the same connection/transaction as the audit insert (matching
`billing/gate.py`'s `_notify_workspace_admins` precedent, not a detached
background task as the brief's pseudocode wording suggests -- see ADR-010).
`dispatch_notification`'s never-raises guarantee covers only its Slack retry
leg -- its DB awaits (insert_notification, the re-entrant
`default_audit_emitter.emit`, get_user_prefs) can still raise. The caller
(`emitter.HashChainAuditEmitter.emit`) is responsible for guarding this call
so a notification-side failure never unwinds the audit insert.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.identity.registry import human_principal_iri

#: security.* events are audit-worthy for the whole tenant, not one
#: workspace -- so notify every tenant-wide admin, not workspace admins.
_TENANT_ADMINS_SQL = (
    "SELECT DISTINCT user_sub FROM workspace_members"
    " WHERE tenant_id = $1 AND role = 'admin' AND status = 'active'"
)


@dataclass(frozen=True)
class SecurityEventContext:
    tenant_id: str
    event_type: str
    actor_principal_iri: str
    target_iri: str
    audit_seq: int


async def notify_tenant_admins_of_security_event(
    conn: asyncpg.Connection, context: SecurityEventContext
) -> None:
    from weave_backend.notifications.dispatch import dispatch_notification
    from weave_backend.notifications.store import NotificationEvent

    payload: dict[str, Any] = {
        "audit_seq": context.audit_seq,
        "actor": context.actor_principal_iri,
        "target": context.target_iri,
    }
    rows = await conn.fetch(_TENANT_ADMINS_SQL, context.tenant_id)
    for row in rows:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=context.tenant_id,
                recipient_iri=human_principal_iri(row["user_sub"]),
                event_type=context.event_type,
                payload=payload,
                actor_iri=context.actor_principal_iri,
            ),
        )
