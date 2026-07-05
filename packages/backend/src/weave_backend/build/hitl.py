"""AC-4/AC-5/AC-6: fail-closed HITL gate mechanics + no-self-approval
enforcement via `PLAT-IDENTITY-1` (BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter
from weave_backend.build import store
from weave_backend.build.store import TaskNotFound, task_iri
from weave_backend.db.pool import get_app_pool
from weave_backend.identity.registry import get_principal, human_principal_iri
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent

#: HITL-gate approvals are tenant-wide, not workspace-scoped -- mirrors
#: `audit/notify.py`'s `_TENANT_ADMINS_SQL` precedent for the same reason
#: (a gate blocks a whole run, not one workspace's admins).
_TENANT_ADMINS_SQL = (
    "SELECT DISTINCT user_sub FROM workspace_members"
    " WHERE tenant_id = $1 AND role = 'admin' AND status = 'active'"
)

_ACTION_OUTCOMES = {"approve": "resumed", "reject": "halted", "amend": "replan"}


class HitlGateClosedError(Exception):
    """AC-5: the audit service is unreachable at gate-evaluation time -- the
    gate MUST stay closed (fail-closed), never auto-approve.
    """


class SelfApprovalNotPermitted(Exception):
    """AC-6: the approving principal IRI matches the submitting agent's."""


@dataclass(frozen=True)
class HitlGateContext:
    tenant_id: str
    task_id: str
    submitting_principal_iri: str
    evidence: str | None


@dataclass(frozen=True)
class HitlResponseContext:
    tenant_id: str
    task_id: str
    approving_principal_iri: str
    action: str
    amendment: str | None = None


async def default_audit_health_check() -> bool:
    """Lightweight reachability probe (task brief: "GET /api/audit/health,
    200ms timeout"). `PLAT-AUDIT-1` lives in-process in this codebase (no
    separate HTTP service to call -- see ADR-001), so "reachable" means the
    audit table's own connection pool answers: a `SELECT 1` on a freshly
    acquired pool connection under an explicit timeout, standing in for
    the brief's HTTP health probe.
    """
    pool = await get_app_pool()
    try:
        async with pool.acquire() as conn:
            await asyncio.wait_for(conn.execute("SELECT 1"), timeout=0.2)
    except (OSError, asyncpg.PostgresError, TimeoutError):
        return False
    return True


async def notify_tenant_admins(
    conn: Any, *, tenant_id: str, event_type: str, payload: dict[str, Any], actor_iri: str
) -> None:
    rows = await conn.fetch(_TENANT_ADMINS_SQL, tenant_id)
    for row in rows:
        await dispatch_notification(
            conn,
            NotificationEvent(
                tenant_id=tenant_id,
                recipient_iri=human_principal_iri(row["user_sub"]),
                event_type=event_type,
                payload=payload,
                actor_iri=actor_iri,
            ),
        )


async def fire_hitl_gate(
    conn: Any,
    ctx: HitlGateContext,
    *,
    health_check: Any = default_audit_health_check,
    notify: Any = notify_tenant_admins,
) -> None:
    """AC-3/AC-5: fail-closed HITL gate. Raises `HitlGateClosedError` (after
    firing an `audit_outage` alert) when the audit service is unreachable,
    rather than ever auto-approving; otherwise fires the `hitl_gate` alert.
    """
    healthy = await health_check()
    if not healthy:
        await notify(
            conn,
            tenant_id=ctx.tenant_id,
            event_type="audit_outage",
            payload={"task_id": ctx.task_id},
            actor_iri=ctx.submitting_principal_iri,
        )
        raise HitlGateClosedError("audit service unreachable; HITL gate stays closed")

    await notify(
        conn,
        tenant_id=ctx.tenant_id,
        event_type="hitl_gate",
        payload={"task_id": ctx.task_id, "evidence": ctx.evidence},
        actor_iri=ctx.submitting_principal_iri,
    )


async def handle_hitl_response(
    conn: Any,
    ctx: HitlResponseContext,
    *,
    resolve_principal: Any = get_principal,
    audit_emitter: AuditEmitter = default_audit_emitter,
) -> dict[str, str]:
    """AC-4/AC-6: apply an approve/reject/amend HITL action, enforcing
    no-self-approval (`SelfApprovalNotPermitted`) via `PLAT-IDENTITY-1`, then
    persist the outcome to `PLAT-AUDIT-1`.
    """
    task = store.get_task(ctx.tenant_id, ctx.task_id)
    if task is None:
        raise TaskNotFound(ctx.task_id)

    approving_principal = await resolve_principal(
        conn, tenant_id=ctx.tenant_id, iri=ctx.approving_principal_iri
    )
    if approving_principal.iri == task.last_agent_principal_iri:
        raise SelfApprovalNotPermitted(ctx.approving_principal_iri)

    if ctx.action == "approve":
        store.update_task_status(ctx.tenant_id, ctx.task_id, "In Progress")
    elif ctx.action == "reject":
        store.update_task_status(
            ctx.tenant_id, ctx.task_id, "Blocked", blocked_reason="hitl_rejected"
        )
    else:
        store.update_task_status(ctx.tenant_id, ctx.task_id, "Draft")

    await audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="hitl_response",
            actor_iri=ctx.approving_principal_iri,
            subject_iri=task_iri(ctx.tenant_id, ctx.task_id),
            payload={"action": ctx.action},
            engine="build",
        ),
    )
    return {"action": _ACTION_OUTCOMES[ctx.action]}
