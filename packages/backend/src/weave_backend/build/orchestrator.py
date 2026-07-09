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

import functools
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from typing import Any

import asyncpg

from weave_backend.briefs.store import get_task_brief
from weave_backend.build import store as task_store
from weave_backend.build.cost import (
    DispatchCostContext,
    RateCardConfigError,
    record_dispatch_cost,
    resolve_rate_card,
)
from weave_backend.build.costs import BudgetBreach, check_budget, notify_budget_breach
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


async def default_dispatch_pdac(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, task: TaskState
) -> DispatchResult:
    """AC-5/AC-6 stub PDAC step: resolve every role's model, best-effort
    load the task's brief, and best-effort load predecessor dep summaries
    (warn, never hold, on a miss). Returns a PASS with an empty dep summary
    -- DELEGATE/ASSESS/CODIFY content generation is out of scope here.
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
            log.warning("missing_handoff", extra={"task_id": task.id, "missing_summary": dep_id})

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
    #: TASK-012 (ADR-008): resolved once at run start (AC-4), then bound
    #: onto `record_dispatch_cost_fn` via `functools.partial` before the
    #: loop -- `_dispatch_one` never takes a 6th parameter for it (Law E).
    resolve_rate_card_fn: Any = resolve_rate_card
    record_dispatch_cost_fn: Any = record_dispatch_cost
    #: TASK-013 (FR-008): read beside the existing turn-cap checkpoint below,
    #: not a second checkpoint concept -- a breach halts before the next
    #: task dispatches.
    check_budget_fn: Any = check_budget
    notify_budget_breach_fn: Any = notify_budget_breach


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
    result, dep_summary = await deps.dispatch_pdac_fn(
        conn, tenant_id=tenant_id, project_iri=spine.project_iri, task=task
    )

    # TASK-012 AC-1: every dispatch with an attributable usage block records
    # one cost_events row, PASS or FAIL alike -- a FAIL still burned tokens.
    # No usage (e.g. the current no-op PDAC stub) means no row: honest,
    # since the stub itself calls no agent SDK.
    if result.usage is not None:
        await deps.record_dispatch_cost_fn(
            conn,
            DispatchCostContext(
                tenant_id=tenant_id,
                project_iri=spine.project_iri,
                task_id=task.id,
                run_id=spine.run_id,
            ),
            result.usage,
        )

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


async def _halt_rate_card_error(
    conn: asyncpg.Connection,
    spine: StateSpine,
    *,
    tenant_id: str,
    deps: OrchestratorDeps,
    exc: RateCardConfigError,
) -> None:
    """TASK-012 AC-4: same run-halt HITL path as `_halt_turn_cap` -- fires
    before `ensure_project_repo`/the dispatch loop even start, so
    `dispatch_count` stays 0.
    """
    spine.phase = "halted_config_error"
    await deps.fire_hitl_gate_fn(
        conn,
        HitlGateContext(
            tenant_id=tenant_id,
            task_id=f"run:{spine.run_id}",
            submitting_principal_iri=BUILD_PRINCIPAL_IRI,
            evidence=f"rate_card_unresolvable:{','.join(sorted(exc.missing_models))}",
        ),
    )
    await commit_state_spine(conn, spine)


async def _halt_budget_breach(
    conn: asyncpg.Connection,
    spine: StateSpine,
    *,
    tenant_id: str,
    deps: OrchestratorDeps,
    breach: BudgetBreach,
) -> None:
    """TASK-013 AC-4/AC-5: unlike `_halt_turn_cap`/`_halt_rate_card_error`,
    the halt is committed *before* notifying -- a `PLAT-NOTIFY-1` emit
    failure (AC-5) must never leave the run un-halted. Both the HITL-gate
    evidence trail and the budget notify are therefore best-effort after
    the commit, each independently guarded.
    """
    spine.phase = "halted_budget_breach"
    await commit_state_spine(conn, spine)

    try:
        await deps.fire_hitl_gate_fn(
            conn,
            HitlGateContext(
                tenant_id=tenant_id,
                task_id=f"run:{spine.run_id}",
                submitting_principal_iri=BUILD_PRINCIPAL_IRI,
                evidence=f"budget_breach_at_{breach.level}",
            ),
        )
    except Exception:
        log.warning("budget_breach_hitl_notify_failed", extra={"project_iri": spine.project_iri})

    try:
        await deps.notify_budget_breach_fn(
            conn, tenant_id=tenant_id, project_iri=spine.project_iri, breach=breach
        )
    except Exception:
        log.warning("budget_breach_notify_failed", extra={"project_iri": spine.project_iri})


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

    TASK-012 AC-4: the rate card is resolved once, before step 0 -- an
    unresolvable card halts the run fail-closed, before any dispatch.
    """
    try:
        rate_card = await deps.resolve_rate_card_fn(
            conn, tenant_id=tenant_id, project_iri=spine.project_iri
        )
    except RateCardConfigError as exc:
        await _halt_rate_card_error(conn, spine, tenant_id=tenant_id, deps=deps, exc=exc)
        return spine
    deps = replace(
        deps,
        record_dispatch_cost_fn=functools.partial(
            deps.record_dispatch_cost_fn, rate_card=rate_card
        ),
    )

    await ensure_project_repo(
        conn, project_iri=spine.project_iri, tenant_id=tenant_id, deps=deps.repo_deps
    )

    breach: BudgetBreach | None = None
    while spine.dispatch_count < spine.turn_cap:
        task = spine.next_ready_task()
        if task is None:
            spine.phase = "complete"
            break
        await _dispatch_one(conn, spine, task, tenant_id=tenant_id, deps=deps)
        spine.dispatch_count += 1
        await commit_state_spine(conn, spine)

        breach = await deps.check_budget_fn(
            conn, tenant_id=tenant_id, project_iri=spine.project_iri
        )
        if breach is not None:
            break

    if breach is not None:
        await _halt_budget_breach(conn, spine, tenant_id=tenant_id, deps=deps, breach=breach)
    elif spine.phase == "running" and spine.dispatch_count >= spine.turn_cap:
        await _halt_turn_cap(conn, spine, tenant_id=tenant_id, deps=deps)
    else:
        # AC-8: the `phase == "complete"` transition (empty/exhausted
        # backlog) is itself a state change -- persist it too, not just the
        # per-dispatch commits inside the loop above.
        await commit_state_spine(conn, spine)

    return spine
