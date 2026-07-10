"""AC-1..AC-6/AC-8: the bounded PLAN->DELEGATE->ASSESS->CODIFY dispatch
loop (BE-TASK-006, build-engine EPIC-011).

The loop contract (turn cap, resume, dep-summary handoff, model-routing
halt, blocking commit) is this task's AC surface. Real PLAN/DELEGATE/
ASSESS/CODIFY agent content generation is TASK-007/008's scope (unlocked
by this task, not yet built) -- `dispatch_pdac_fn` is injectable so a real
agent implementation drops in later without touching the loop itself.
`default_dispatch_pdac` proves the loop contract (model routing, dep-summary
handoff) without generating any code/spec content.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.briefs.store import get_task_brief
from weave_backend.build import store as task_store
from weave_backend.build.dep_summary import DepSummary, dep_summary_exists, write_dep_summary
from weave_backend.build.hitl import HitlGateContext, fire_hitl_gate
from weave_backend.build.model_routing import ModelRoutingError, resolve_model
from weave_backend.build.state_spine import (
    BUILD_PRINCIPAL_IRI,
    StateSpine,
    TaskState,
    commit_state_spine,
)
from weave_backend.build.typed_result import AgentResultContext, handle_agent_result
from weave_backend.repo_bootstrap.service import (
    DEFAULT_DEPS as DEFAULT_REPO_DEPS,
)
from weave_backend.repo_bootstrap.service import (
    RepoBootstrapDeps,
    ensure_project_repo,
)
from weave_backend.schemas.tasks import TypedResult

log = logging.getLogger(__name__)

#: PDAC roles resolved before every dispatch (AC-6) -- resolving all four up
#: front means a routing miss on any role halts the cycle before DELEGATE/
#: ASSESS/CODIFY are ever reached, never a partial, silently-degraded run.
PDAC_ROLES = ("plan", "delegate", "assess", "codify")

DispatchResult = tuple[TypedResult, DepSummary | None]
DispatchFn = Callable[..., Awaitable[DispatchResult]]


class TaskHeld(Exception):
    """TASK-009/FR-043: raised by PLAN when a predecessor's dep-summary is
    missing -- replaces the M1 best-effort warn-and-continue path. Caught
    by `_dispatch_one`, never by `default_dispatch_pdac`'s own caller.
    """

    def __init__(self, *, missing_dep_id: str) -> None:
        super().__init__(f"dep summary missing for predecessor {missing_dep_id}")
        self.missing_dep_id = missing_dep_id


async def default_dispatch_pdac(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, task: TaskState
) -> DispatchResult:
    """AC-6 PDAC step: resolve every role's model, best-effort load the
    task's brief, and read each predecessor's dep summary -- a miss raises
    `TaskHeld` (FR-043; no longer best-effort/warn-and-continue).
    """
    for role in PDAC_ROLES:
        try:
            resolve_model(role)
        except ModelRoutingError as exc:
            return (
                TypedResult(
                    status="FAIL",
                    failure_class="dependency",
                    evidence=str(exc),
                    retry_recommended=False,
                ),
                None,
            )

    await get_task_brief(conn, tenant_id=tenant_id, task_id=task.id)

    for dep_id in task.blocked_by:
        if not await dep_summary_exists(
            conn, tenant_id=tenant_id, project_iri=project_iri, task_id=dep_id
        ):
            raise TaskHeld(missing_dep_id=dep_id)

    return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)


@dataclass(frozen=True)
class OrchestratorDeps:
    """Groups the loop's injectable collaborators (Law E 5-param budget) --
    same grouping precedent as `RepoBootstrapDeps`/`briefs.store.NewBrief`.
    """

    repo_deps: RepoBootstrapDeps = DEFAULT_REPO_DEPS
    dispatch_pdac_fn: DispatchFn = default_dispatch_pdac
    fire_hitl_gate_fn: Any = fire_hitl_gate
    handle_agent_result_fn: Any = handle_agent_result


DEFAULT_ORCHESTRATOR_DEPS = OrchestratorDeps()


async def _dispatch_one(
    conn: asyncpg.Connection,
    spine: StateSpine,
    task: TaskState,
    *,
    tenant_id: str,
    deps: OrchestratorDeps,
) -> None:
    """One PLAN->DELEGATE->ASSESS->CODIFY cycle for `task`, mutating it and
    `spine` in place. FAIL routes through TASK-005's retry/HITL machinery
    (AC-2/AC-6); PASS writes the dep summary before marking the task Done
    (AC-4, non-skippable CODIFY).
    """
    try:
        result, dep_summary = await deps.dispatch_pdac_fn(
            conn, tenant_id=tenant_id, project_iri=spine.project_iri, task=task
        )
    except TaskHeld as exc:
        task.status = "Ready"
        task.hold_reason = "dep_summary_missing"
        log.info(
            "task_held",
            extra={"task_id": task.id, "missing_summary": exc.missing_dep_id},
        )
        return

    if result.status == "FAIL":
        if task_store.get_task(tenant_id, task.id) is None:
            task_store.create_task(tenant_id, task.id, project_iri=spine.project_iri)
        outcome = await deps.handle_agent_result_fn(
            conn,
            AgentResultContext(
                tenant_id=tenant_id, actor_iri=BUILD_PRINCIPAL_IRI, task_id=task.id, result=result
            ),
        )
        if outcome["action"] == "hitl_gate":
            task.status = "Blocked"
        return

    summary = dep_summary if dep_summary is not None else DepSummary(task_id=task.id)
    await write_dep_summary(
        conn, tenant_id=tenant_id, project_iri=spine.project_iri, summary=summary
    )
    task.codify_checkpoint = summary.model_dump()
    task.status = "Done"


async def _halt_turn_cap(
    conn: asyncpg.Connection, spine: StateSpine, *, tenant_id: str, deps: OrchestratorDeps
) -> None:
    spine.phase = "halted_turn_cap"
    await deps.fire_hitl_gate_fn(
        conn,
        HitlGateContext(
            tenant_id=tenant_id,
            task_id=f"run:{spine.run_id}",
            submitting_principal_iri=BUILD_PRINCIPAL_IRI,
            evidence="turn_cap_reached",
        ),
    )
    await commit_state_spine(conn, spine)


async def run_dark_factory(
    conn: asyncpg.Connection,
    spine: StateSpine,
    *,
    tenant_id: str,
    deps: OrchestratorDeps = DEFAULT_ORCHESTRATOR_DEPS,
) -> StateSpine:
    """AC-1..AC-6/AC-8: run step 0 (repo bootstrap, halts fail-closed before
    the first PLAN) then the bounded dispatch loop over `spine.tasks`,
    committing after every cycle. `spine.dispatch_count`/`turn_cap` are
    already resumed/resolved by the caller (`start_or_resume_run`) -- the
    cap is read once at run start, never re-read mid-run.
    """
    await ensure_project_repo(
        conn, project_iri=spine.project_iri, tenant_id=tenant_id, deps=deps.repo_deps
    )

    while spine.dispatch_count < spine.turn_cap:
        task = spine.next_ready_task()
        if task is None:
            spine.phase = "complete"
            break
        await _dispatch_one(conn, spine, task, tenant_id=tenant_id, deps=deps)
        spine.dispatch_count += 1
        await commit_state_spine(conn, spine)

    if spine.phase == "running" and spine.dispatch_count >= spine.turn_cap:
        await _halt_turn_cap(conn, spine, tenant_id=tenant_id, deps=deps)
    else:
        # AC-8: the `phase == "complete"` transition (empty/exhausted
        # backlog) is itself a state change -- persist it too, not just the
        # per-dispatch commits inside the loop above.
        await commit_state_spine(conn, spine)

    return spine
