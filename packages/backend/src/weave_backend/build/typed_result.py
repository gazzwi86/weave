"""AC-2/AC-3/AC-8: `TypedResult` FAIL classification, per-class retry
ceiling (`PLAT-SETTINGS-1`), and ceiling-hit HITL routing (`PLAT-NOTIFY-1`)
(BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter
from weave_backend.build import store
from weave_backend.build.hitl import HitlGateContext, fire_hitl_gate
from weave_backend.build.store import TaskNotFound, task_iri
from weave_backend.schemas.tasks import TypedResult
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri

#: Sensible defaults (implementation hint), overridable per-project via
#: `PLAT-SETTINGS-1` (`build.retry_ceiling.<failure_class>`).
DEFAULT_RETRY_CEILINGS: dict[str, int] = {
    "logic": 3,
    "syntax": 2,
    "dependency": 1,
    "spec_ambiguity": 1,
}


@dataclass(frozen=True)
class AgentResultContext:
    tenant_id: str
    actor_iri: str
    task_id: str
    result: TypedResult


async def get_retry_ceiling(
    conn: Any, *, tenant_id: str, project_iri: str | None, failure_class: str
) -> int:
    """AC-2: per-class retry ceiling, resolved via `PLAT-SETTINGS-1` when the
    task has a project scope to resolve against, else `DEFAULT_RETRY_CEILINGS`.
    """
    default_ceiling = DEFAULT_RETRY_CEILINGS[failure_class]
    if project_iri is None:
        return default_ceiling
    try:
        resolved = await resolve_setting(
            conn,
            tenant_id=tenant_id,
            key=f"build.retry_ceiling.{failure_class}",
            context_iri=project_iri,
        )
    except (SettingNotFound, InvalidScopeIri):
        return default_ceiling
    return int(resolved.value)


async def handle_agent_result(
    conn: Any,
    ctx: AgentResultContext,
    *,
    audit_emitter: AuditEmitter = default_audit_emitter,
    fire_hitl_gate_fn: Any = fire_hitl_gate,
) -> dict[str, Any]:
    """AC-2/AC-3/AC-8: classify a `TypedResult`, persist it to `PLAT-AUDIT-1`,
    and either proceed (PASS), retry (FAIL under ceiling), or route to the
    HITL gate (FAIL at ceiling) -- never a silent extra retry past ceiling.
    """
    task = store.get_task(ctx.tenant_id, ctx.task_id)
    if task is None:
        raise TaskNotFound(ctx.task_id)

    store.set_last_agent_principal(ctx.tenant_id, ctx.task_id, ctx.actor_iri)
    await audit_emitter.emit(
        conn,
        AuditEvent(
            tenant_id=ctx.tenant_id,
            event_type="agent_result",
            actor_iri=ctx.actor_iri,
            subject_iri=task_iri(ctx.tenant_id, ctx.task_id),
            payload={
                "status": ctx.result.status,
                "failure_class": ctx.result.failure_class,
                "evidence": ctx.result.evidence,
            },
            engine="build",
        ),
    )

    if ctx.result.status == "PASS":
        store.update_task_status(ctx.tenant_id, ctx.task_id, "ASSESS_PASSED")
        return {"action": "proceed", "retry_count": None}

    if ctx.result.failure_class is None:
        # Unreachable: `TypedResult`'s own validator requires this whenever
        # status == "FAIL" (validation IS the classification, Law 13).
        msg = "failure_class must be set for a FAIL result"
        raise ValueError(msg)
    failure_class = ctx.result.failure_class

    ceiling = await get_retry_ceiling(
        conn, tenant_id=ctx.tenant_id, project_iri=task.project_iri, failure_class=failure_class
    )
    retry_count = store.increment_retry(ctx.tenant_id, ctx.task_id, failure_class)

    if retry_count > ceiling:
        await fire_hitl_gate_fn(
            conn,
            HitlGateContext(
                tenant_id=ctx.tenant_id,
                task_id=ctx.task_id,
                submitting_principal_iri=ctx.actor_iri,
                evidence=ctx.result.evidence,
            ),
        )
        store.update_task_status(
            ctx.tenant_id, ctx.task_id, "Blocked", blocked_reason="ceiling_hit"
        )
        return {"action": "hitl_gate", "retry_count": None}

    return {"action": "retry", "retry_count": retry_count}
