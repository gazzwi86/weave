"""BE-TASK-006 (build-engine EPIC-011) unit tests for the dark-factory
dispatch loop: turn cap, cap-halt-to-HITL, crash/cap resume, non-skippable
CODIFY dep-summary write, best-effort predecessor handoff, and fail-closed
model routing. Exercised against a `_FakeConnection` stand-in (same pattern
as `test_repo_bootstrap_service.py`) -- no real Postgres/network needed;
the DB-round-trip proof lives in `tests/integration/test_runs_api.py`.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.build import model_routing
from weave_backend.build import store as task_store
from weave_backend.build.dep_summary import DepSummary
from weave_backend.build.hitl import HitlGateContext
from weave_backend.build.orchestrator import (
    OrchestratorDeps,
    TaskHeld,
    _dispatch_one,
    default_dispatch_pdac,
    run_dark_factory,
)
from weave_backend.build.state_spine import (
    Phase,
    StateSpine,
    StateSpineCommitTimeout,
    TaskState,
    commit_state_spine,
)
from weave_backend.build.typed_result import handle_agent_result
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps
from weave_backend.schemas.tasks import TypedResult

_TENANT = "tenant-orch"
_PROJECT_IRI = f"urn:weave:project:{_TENANT}:acme"

_REPO_ROW = {
    "name": "Acme",
    "source_control_provider": "github",
    "source_control_token_secret_ref": "weave/scm-token",
    "repo_provider": "github",
    "repo_url": "https://scm/acme/repo",
    "repo_default_branch": "main",
    "repo_id": "acme/repo",
}


class _FakeConnection:
    """Routes `fetchrow` by SQL substring so the same fake serves every
    collaborator `run_dark_factory` touches (repo-row lookup, best-effort
    brief/dep-summary reads) without a real Postgres connection.
    """

    def __init__(self, *, dep_summary_row: dict[str, Any] | None = None) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._dep_summary_row = dep_summary_row

    async def fetchrow(self, query: str, *_args: Any) -> dict[str, Any] | None:
        if "FROM projects" in query:
            return dict(_REPO_ROW)
        if "FROM task_briefs" in query:
            return None
        if "FROM dep_summaries" in query:
            return self._dep_summary_row
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


def _repo_deps() -> RepoBootstrapDeps:
    # Never reached: `_REPO_ROW` already has a full repo handle, so
    # `ensure_project_repo` takes the idempotent short-circuit (AC-3 of
    # TASK-010) before touching get_secret/driver_for.
    async def _unreachable_secret(_ref: str) -> str | None:
        raise AssertionError("get_secret should not be called (existing repo row)")

    def _unreachable_driver(_provider: str) -> Any:
        raise AssertionError("driver_for should not be called (existing repo row)")

    async def _noop_audit(_conn: Any, _event: Any) -> None:
        return None

    return RepoBootstrapDeps(
        get_secret=_unreachable_secret, driver_for=_unreachable_driver, emit_audit=_noop_audit
    )


def _spine(*, turn_cap: int, tasks: list[TaskState], phase: Phase = "running") -> StateSpine:
    return StateSpine(
        project_iri=_PROJECT_IRI,
        tenant_id=_TENANT,
        run_id="run-1",
        phase=phase,
        dispatch_count=0,
        turn_cap=turn_cap,
        tasks=tasks,
    )


async def _always_pass(conn: Any, *, tenant_id: str, project_iri: str, task: TaskState) -> Any:
    return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)


@pytest.fixture(autouse=True)
def _reset_task_store() -> None:
    task_store.reset_for_tests()


async def test_orchestrator_halts_at_turn_cap_60() -> None:
    """AC-1: 65 queued tasks, turn_cap=60 -> exactly 60 dispatch cycles run,
    the remaining 5 are left untouched (state preserved, not discarded).
    """
    tasks = [TaskState(id=f"t{i}", status="Queued") for i in range(65)]
    spine = _spine(turn_cap=60, tasks=tasks)
    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(), dispatch_pdac_fn=_always_pass, fire_hitl_gate_fn=_fake_hitl
    )
    conn = _FakeConnection()

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.dispatch_count == 60
    assert result.phase == "halted_turn_cap"
    assert [t.status for t in result.tasks[:60]] == ["Done"] * 60
    assert [t.status for t in result.tasks[60:]] == ["Queued"] * 5
    assert len(hitl_calls) == 1
    assert hitl_calls[0].evidence == "turn_cap_reached"


async def test_either_cap_halt_routes_to_hitl_with_state_preserved() -> None:
    """AC-2: the per-agent-cap-shaped halt (repeated FAIL/logic results,
    surfaced to the orchestrator as `TypedResult`) exhausts its retry
    ceiling and routes to the real `handle_agent_result` HITL escalation,
    with the task's identity/history preserved (not reset). The turn-cap
    branch of "either cap" is proven separately by
    `test_orchestrator_halts_at_turn_cap_60`.
    """

    async def _always_fail_logic(
        conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> Any:
        return (
            TypedResult(
                status="FAIL",
                failure_class="logic",
                evidence="agent cap hit",
                retry_recommended=True,
            ),
            None,
        )

    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    class _FakeAuditEmitter:
        async def emit(self, _conn: Any, _event: Any) -> None:
            return None

    async def _handle_agent_result(conn: Any, ctx: Any, **_kw: Any) -> dict[str, Any]:
        return await handle_agent_result(
            conn, ctx, fire_hitl_gate_fn=_fake_hitl, audit_emitter=_FakeAuditEmitter()
        )

    spine = _spine(turn_cap=10, tasks=[TaskState(id="t1", status="Queued")])
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_fail_logic,
        handle_agent_result_fn=_handle_agent_result,
    )
    conn = _FakeConnection()

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    # DEFAULT_RETRY_CEILINGS["logic"] == 3: the 4th FAIL exceeds the
    # ceiling and escalates -- full state (which task, at what point) is
    # visible on the spine, not discarded.
    assert result.dispatch_count == 4
    assert result.tasks[0].status == "Blocked"
    assert len(hitl_calls) == 1


async def test_resume_from_codify_checkpoint_after_crash() -> None:
    """AC-3: a task with an already-committed CODIFY checkpoint is resumed
    from that checkpoint on the next dispatch, not restarted from scratch
    -- `default_dispatch_pdac` is never invoked for it because it's Done.
    """
    checkpoint = {
        "task_id": "t1",
        "decisions": ["chose X"],
        "edge_cases": [],
        "outputs": ["file.py"],
    }
    done_task = TaskState(id="t1", status="Done", codify_checkpoint=checkpoint)
    queued_task = TaskState(id="t2", status="Queued")
    spine = _spine(turn_cap=10, tasks=[done_task, queued_task], phase="halted_turn_cap")

    calls: list[str] = []

    async def _tracking_pass(
        conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> Any:
        calls.append(task.id)
        return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)

    deps = OrchestratorDeps(repo_deps=_repo_deps(), dispatch_pdac_fn=_tracking_pass)
    conn = _FakeConnection()

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert calls == ["t2"]  # t1 never re-dispatched -- its checkpoint stands
    assert result.tasks[0].codify_checkpoint == checkpoint
    assert result.tasks[1].status == "Done"


async def test_codify_writes_dep_summary_before_task_done() -> None:
    """AC-4: the dep-summary write happens before the task is marked Done,
    and a write failure leaves the task NOT Done -- CODIFY can't be
    skipped by a downstream error.
    """
    summary = DepSummary(task_id="t1", decisions=["chose X"], outputs=["a.py"])

    async def _pass_with_summary(
        conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> Any:
        return TypedResult(status="PASS", retry_recommended=False), summary

    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()
    deps = OrchestratorDeps(repo_deps=_repo_deps(), dispatch_pdac_fn=_pass_with_summary)

    await _dispatch_one(conn, spine, task, tenant_id=_TENANT, deps=deps)

    assert any("dep_summaries" in query for query, _args in conn.executed)
    assert task.status == "Done"
    assert task.codify_checkpoint == summary.model_dump()

    # Failure-path: if the write itself fails, Done must never be reached.
    class _FailingConn(_FakeConnection):
        async def execute(self, query: str, *args: Any) -> None:
            if "dep_summaries" in query:
                raise RuntimeError("write failed")
            await super().execute(query, *args)

    other_task = TaskState(id="t2", status="Queued")
    other_spine = _spine(turn_cap=10, tasks=[other_task])
    with pytest.raises(RuntimeError):
        await _dispatch_one(_FailingConn(), other_spine, other_task, tenant_id=_TENANT, deps=deps)
    assert other_task.status == "Queued"


async def test_plan_raises_task_held_when_predecessor_summary_missing() -> None:
    """TASK-009/AC-6: a missing predecessor summary raises `TaskHeld` --
    replaces the M1 warn-and-proceed stub (FR-043 no longer best-effort).
    """
    task = TaskState(id="t2", status="Queued", blocked_by=["t1"])
    conn = _FakeConnection(dep_summary_row=None)

    with pytest.raises(TaskHeld) as exc_info:
        await default_dispatch_pdac(conn, tenant_id=_TENANT, project_iri=_PROJECT_IRI, task=task)
    assert exc_info.value.missing_dep_id == "t1"


async def test_hold_task_in_ready_when_predecessor_summary_missing() -> None:
    """AC-6: `should hold task in Ready when predecessor dep summary
    missing` -- `_dispatch_one` catches `TaskHeld` and holds the task in
    `Ready` with `hold_reason="dep_summary_missing"` rather than failing
    the cycle or marking it Done.
    """
    task = TaskState(id="t2", status="Queued", blocked_by=["t1"])
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection(dep_summary_row=None)
    deps = OrchestratorDeps(repo_deps=_repo_deps(), dispatch_pdac_fn=default_dispatch_pdac)

    await _dispatch_one(conn, spine, task, tenant_id=_TENANT, deps=deps)

    assert task.status == "Ready"
    assert task.hold_reason == "dep_summary_missing"


def test_next_ready_task_skips_held_task() -> None:
    """AC-6 (loop-progress corollary): a held task must not spin the
    dispatch loop -- `next_ready_task` skips it so the rest of the backlog
    still makes progress.
    """
    held = TaskState(id="t1", status="Ready", hold_reason="dep_summary_missing")
    next_up = TaskState(id="t2", status="Queued")
    spine = _spine(turn_cap=10, tasks=[held, next_up])

    assert spine.next_ready_task() is next_up


async def test_model_routing_miss_halts_task_not_silent_invoke(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-6: a role with no valid model halts the task via a FAIL result --
    it must never fall through to invoking some other model. Proven by
    asserting no further collaborator (brief/dep-summary lookup) runs
    after the miss, and the fake conn is never touched at all.
    """
    monkeypatch.delitem(model_routing.ROLE_TIER, "delegate", raising=False)
    task = TaskState(id="t1", status="Queued")

    class _UntouchedConnection:
        async def fetchrow(self, *_args: Any) -> None:
            raise AssertionError("no DB call should happen after a routing miss")

    result, summary = await default_dispatch_pdac(
        _UntouchedConnection(), tenant_id=_TENANT, project_iri=_PROJECT_IRI, task=task
    )

    assert result.status == "FAIL"
    assert result.failure_class == "dependency"
    assert summary is None


async def test_turn_cap_never_re_resolved_mid_run(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC-1 edge case (QA-added): `PLAT-SETTINGS-1` is resolved once by the
    API layer before the run starts (`routers.runs._effective_turn_cap`) and
    stored on the spine -- `run_dark_factory` itself must never re-resolve
    it mid-run, or a settings change during an active run could retroactively
    change its cap. Proven by making `resolve_setting` explode if called at
    all during the loop, not just by asserting the final dispatch count.
    """
    from weave_backend.settings import resolver

    async def _boom(*_a: Any, **_kw: Any) -> Any:
        raise AssertionError("run_dark_factory must never call resolve_setting mid-run")

    monkeypatch.setattr(resolver, "resolve_setting", _boom)

    async def _fake_hitl(_conn: Any, _ctx: HitlGateContext, **_kw: Any) -> None:
        return None

    tasks = [TaskState(id=f"t{i}", status="Queued") for i in range(3)]
    spine = _spine(turn_cap=2, tasks=tasks)
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(), dispatch_pdac_fn=_always_pass, fire_hitl_gate_fn=_fake_hitl
    )

    result = await run_dark_factory(_FakeConnection(), spine, tenant_id=_TENANT, deps=deps)

    assert result.dispatch_count == 2
    assert result.phase == "halted_turn_cap"


async def test_run_dark_factory_propagates_commit_timeout_not_swallowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-8 edge case (QA-added): a commit timeout hit *during the dispatch
    loop* (not just a direct `commit_state_spine` call) must propagate out
    of `run_dark_factory` rather than being caught and treated as a
    successful cycle -- the existing AC-8 test only proves
    `commit_state_spine` itself raises; this proves the loop doesn't
    swallow that exception on the way out.
    """
    import asyncio

    from weave_backend.audit.emitter import default_audit_emitter

    async def _noop_emit(_conn: Any, _event: Any) -> None:
        return None

    # `commit_state_spine`'s `audit_emitter` default isn't reachable through
    # `OrchestratorDeps` -- patch the shared singleton's `emit` instead of
    # standing up the real hash-chain audit path in the fake connection.
    monkeypatch.setattr(default_audit_emitter, "emit", _noop_emit)

    class _SlowOnStateSpineConnection(_FakeConnection):
        async def execute(self, query: str, *args: Any) -> None:
            if "state_spines" in query:
                await asyncio.sleep(0.6)
                return
            await super().execute(query, *args)

    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    deps = OrchestratorDeps(repo_deps=_repo_deps(), dispatch_pdac_fn=_always_pass)

    with pytest.raises(StateSpineCommitTimeout):
        await run_dark_factory(
            _SlowOnStateSpineConnection(), spine, tenant_id=_TENANT, deps=deps
        )


async def test_state_spine_commit_blocks_on_timeout() -> None:
    """AC-8: a commit slower than the timeout raises
    `StateSpineCommitTimeout` and never returns normally -- the caller
    (the dispatch loop) never proceeds to mark the task Done on a timeout.
    """
    import asyncio

    class _SlowConnection:
        async def execute(self, *_args: Any) -> None:
            await asyncio.sleep(0.2)

    audit_calls: list[Any] = []

    class _FakeEmitter:
        async def emit(self, _conn: Any, event: Any) -> None:
            audit_calls.append(event)

    spine = _spine(turn_cap=10, tasks=[])

    with pytest.raises(StateSpineCommitTimeout):
        await commit_state_spine(
            _SlowConnection(), spine, timeout=0.05, audit_emitter=_FakeEmitter()
        )

    assert len(audit_calls) == 1
    assert audit_calls[0].event_type == "state_spine_commit_timeout"
