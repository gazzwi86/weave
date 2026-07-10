"""AC-1/AC-3/AC-7/AC-8: the dark-factory run's persisted, RLS-isolated
state (BE-TASK-006, build-engine EPIC-011) -- dispatch-cycle count, the
per-task backlog, and each task's last-committed CODIFY checkpoint (AC-3's
resume point). Migration 0012.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Literal

import asyncpg
from pydantic import BaseModel, Field

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter

#: AC-8's p99 target -- a slower commit blocks the task from being marked
#: Done rather than silently completing late (Implementation Hints).
COMMIT_TIMEOUT_SECONDS = 0.5

#: Attributed as the audit/HITL actor for run-level (not per-task) events --
#: mirrors `repo_bootstrap.service.BUILD_SERVICE_PRINCIPAL_IRI`.
BUILD_PRINCIPAL_IRI = "urn:weave:principal:service:build-engine"

Phase = Literal[
    "running",
    "halted_turn_cap",
    "halted_hitl",
    "halted_config_error",
    "halted_budget_breach",
    "complete",
]


class TaskState(BaseModel):
    id: str
    status: str
    blocked_by: list[str] = Field(default_factory=list)
    codify_checkpoint: dict[str, Any] | None = None
    #: TASK-009/FR-043: set when PLAN held the task on a missing predecessor
    #: dep-summary (`"dep_summary_missing"`) -- stored in the same JSONB
    #: `tasks` blob, no migration needed.
    hold_reason: str | None = None


class StateSpine(BaseModel):
    project_iri: str
    tenant_id: str
    run_id: str
    phase: Phase = "running"
    dispatch_count: int = 0
    turn_cap: int
    tasks: list[TaskState] = Field(default_factory=list)

    def next_ready_task(self) -> TaskState | None:
        """AC-1 pseudocode's `next_ready_task` -- the first task not yet
        `Done`/`Blocked`/`revision`. M1 has no priority/parallelism
        scheduling beyond list order (out of this task's AC scope).
        `revision` (AC-5: self-verify found a violated rule) is excluded
        the same way `Blocked` is -- redispatching it immediately would
        retry against the same violation with no rework step in between;
        resubmission is a documented future extension, not built here.

        TASK-009/FR-043: a task held on a missing predecessor dep-summary
        (`hold_reason` set) is also skipped -- otherwise every remaining
        dispatch cycle re-selects the same held task and spins to the turn
        cap instead of making progress on the rest of the backlog.
        """
        for task in self.tasks:
            if (
                task.status not in ("Done", "Blocked", "revision")
                and task.hold_reason is None
            ):
                return task
        return None


class StateSpineCommitTimeout(Exception):
    """AC-8: the commit did not complete within `COMMIT_TIMEOUT_SECONDS` --
    caller must NOT mark the task Done.
    """

    def __init__(self, project_iri: str) -> None:
        super().__init__(f"state spine commit timed out for {project_iri}")
        self.project_iri = project_iri


class RunAlreadyActive(Exception):
    """API 409: an existing run for this project is still `phase == "running"`."""

    def __init__(self, run_id: str) -> None:
        super().__init__(run_id)
        self.run_id = run_id


def _parse_tasks(raw: Any) -> list[TaskState]:
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    return [TaskState.model_validate(t) for t in parsed]


async def load_state_spine(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> StateSpine | None:
    """AC-7: scoped to `tenant_id` (RLS also enforces this at the DB level;
    the explicit filter is defence-in-depth, not the sole guard).
    """
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    row = await conn.fetchrow(
        "SELECT tenant_id, run_id, phase, dispatch_count, turn_cap, tasks"
        " FROM state_spines WHERE tenant_id = $1 AND project_iri = $2",
        tenant_id,
        project_iri,
    )
    if row is None:
        return None
    return StateSpine(
        project_iri=project_iri,
        tenant_id=row["tenant_id"],
        run_id=row["run_id"],
        phase=row["phase"],
        dispatch_count=row["dispatch_count"],
        turn_cap=row["turn_cap"],
        tasks=_parse_tasks(row["tasks"]),
    )


async def _commit_now(conn: asyncpg.Connection, spine: StateSpine) -> None:
    # nosemgrep: python.lang.security.audit.sqli.asyncpg-sqli.asyncpg-sqli
    await conn.execute(
        """
        INSERT INTO state_spines
            (project_iri, tenant_id, run_id, phase, dispatch_count, turn_cap, tasks)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (project_iri) DO UPDATE SET
            run_id = EXCLUDED.run_id,
            phase = EXCLUDED.phase,
            dispatch_count = EXCLUDED.dispatch_count,
            turn_cap = EXCLUDED.turn_cap,
            tasks = EXCLUDED.tasks,
            updated_at = now()
        """,
        spine.project_iri,
        spine.tenant_id,
        spine.run_id,
        spine.phase,
        spine.dispatch_count,
        spine.turn_cap,
        json.dumps([t.model_dump() for t in spine.tasks]),
    )


async def commit_state_spine(
    conn: asyncpg.Connection,
    spine: StateSpine,
    *,
    timeout: float = COMMIT_TIMEOUT_SECONDS,
    audit_emitter: AuditEmitter = default_audit_emitter,
) -> None:
    """AC-8: blocking, synchronous commit under a 500ms p99 target. A
    single JSONB blob write is atomic -- a timeout means the previous
    persisted row (never containing the in-flight `Done` transition)
    stands, so there is no partial-Done state to clean up; it also raises
    `StateSpineCommitTimeout` (after emitting `state_spine_commit_timeout`
    to `PLAT-AUDIT-1`) so the caller never silently treats the task as Done.
    """
    try:
        await asyncio.wait_for(_commit_now(conn, spine), timeout=timeout)
    except TimeoutError as exc:
        await audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=spine.tenant_id,
                event_type="state_spine_commit_timeout",
                actor_iri=BUILD_PRINCIPAL_IRI,
                subject_iri=spine.project_iri,
                payload={"dispatch_count": spine.dispatch_count},
                engine="build",
            ),
        )
        raise StateSpineCommitTimeout(spine.project_iri) from exc


async def start_or_resume_run(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str, run_id: str, turn_cap: int
) -> StateSpine:
    """AC-3/API 409: reuse an existing halted/complete spine's progress
    (`dispatch_count`, `tasks` and their `codify_checkpoint`s) under a
    fresh `run_id`; raise `RunAlreadyActive` if the existing spine's phase
    is still `"running"`.

    ponytail: M1 has no heartbeat/crash-detection (Implementation Hints),
    so a `"running"` row left behind by a genuine crash is indistinguishable
    from one still actually in flight -- both refuse a new run here. Add
    heartbeat-based reconciliation if that turns out to matter operationally.
    """
    existing = await load_state_spine(conn, tenant_id=tenant_id, project_iri=project_iri)
    if existing is not None and existing.phase == "running":
        raise RunAlreadyActive(existing.run_id)
    tasks = existing.tasks if existing is not None else []
    dispatch_count = existing.dispatch_count if existing is not None else 0
    return StateSpine(
        project_iri=project_iri,
        tenant_id=tenant_id,
        run_id=run_id,
        phase="running",
        dispatch_count=dispatch_count,
        turn_cap=turn_cap,
        tasks=tasks,
    )
