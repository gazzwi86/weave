"""BE-TASK-006 (build-engine EPIC-011) unit tests for the dark-factory
dispatch loop: turn cap, cap-halt-to-HITL, crash/cap resume, non-skippable
CODIFY dep-summary write, best-effort predecessor handoff, and fail-closed
model routing. Exercised against a `_FakeConnection` stand-in (same pattern
as `test_repo_bootstrap_service.py`) -- no real Postgres/network needed;
the DB-round-trip proof lives in `tests/integration/test_runs_api.py`.
"""

from __future__ import annotations

import functools
from decimal import Decimal
from typing import Any

import pytest

from weave_backend.build import model_routing
from weave_backend.build import orchestrator as orchestrator_module
from weave_backend.build import store as task_store
from weave_backend.build.cost import ModelRate, RateCardConfigError, record_dispatch_cost
from weave_backend.build.costs import BudgetBreach
from weave_backend.build.dep_summary import DepSummary
from weave_backend.build.hitl import HitlGateContext
from weave_backend.build.orchestrator import (
    OrchestratorDeps,
    TaskHeld,
    _dispatch_one,
    default_dispatch_pdac,
    run_dark_factory,
)
from weave_backend.build.self_verify import self_verify
from weave_backend.build.state_spine import (
    Phase,
    StateSpine,
    StateSpineCommitTimeout,
    TaskState,
    commit_state_spine,
)
from weave_backend.build.typed_result import handle_agent_result
from weave_backend.repo_bootstrap.drivers import RepoHandle
from weave_backend.repo_bootstrap.rich_scaffold import ScaffoldFailed
from weave_backend.repo_bootstrap.service import RepoBootstrapDeps
from weave_backend.schemas.tasks import DispatchUsage, TypedResult

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
    # BE-TASK-006 AC-7: pre-existing tests model an *already-verified*
    # project (env-verification approved, held released) so `rich_scaffold`
    # takes its idempotent short-circuit and the dispatch loop runs exactly
    # as it did before AC-7 existed -- the held/pending case gets its own
    # dedicated tests below.
    "feature_dispatch_held": False,
}


class _FakeConnection:
    """Routes `fetchrow` by SQL substring so the same fake serves every
    collaborator `run_dark_factory` touches (repo-row lookup, best-effort
    brief/dep-summary reads) without a real Postgres connection.
    """

    def __init__(
        self,
        *,
        dep_summary_row: dict[str, Any] | None = None,
        repo_row: dict[str, Any] | None = None,
    ) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._dep_summary_row = dep_summary_row
        self._repo_row = repo_row if repo_row is not None else _REPO_ROW

    async def fetchrow(self, query: str, *_args: Any) -> dict[str, Any] | None:
        if "FROM projects" in query:
            return dict(self._repo_row)
        if "FROM task_briefs" in query:
            return None
        if "FROM dep_summaries" in query:
            return self._dep_summary_row
        raise AssertionError(f"unexpected fetchrow: {query}")

    async def fetch(self, query: str, *_args: Any) -> list[dict[str, Any]]:
        # TASK-013: `check_budget`'s default `resolve_budget_cap` reads the
        # settings cascade every checkpoint (unlike the turn cap, resolved
        # once) -- no cap seeded here means `SettingNotFound` -> unmetered,
        # so the existing turn-cap/resume tests are unaffected.
        if "scope_iri = ANY($2)" in query:
            return []
        raise AssertionError(f"unexpected fetch: {query}")

    async def execute(self, query: str, *args: Any) -> None:
        self.executed.append((query, args))


class _NoAnatomyDriver:
    """`_repo_deps()`'s `driver_for` stub -- `ensure_project_repo` never
    reaches it (see below), but TASK-009/AC-2's `load_task_context` does,
    on every dispatch cycle. No `ANATOMY.md` committed -- `read_file`
    returns `None`, leaving `task.context` untouched (harmless no-op for
    the many pre-existing tests that don't care about anatomy loading).
    Every other `ScmDriver` member is a `NotImplementedError` stub purely
    to satisfy the structural type -- none is reachable here (same
    convention as `test_rich_scaffold.py`'s `_FakeDriver`).
    """

    async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
        raise NotImplementedError

    async def write_initial_commit(
        self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
    ) -> None:
        raise NotImplementedError

    async def commit_workspace(
        self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
    ) -> str:
        raise NotImplementedError

    async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
        raise NotImplementedError

    async def commit_files(
        self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
    ) -> str:
        raise NotImplementedError

    async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
        return None


def _repo_deps() -> RepoBootstrapDeps:
    # `ensure_project_repo`/`rich_scaffold`'s own SCM calls (create_repo
    # et al.) are never reached: `_REPO_ROW` already has a full repo
    # handle, so `ensure_project_repo` takes the idempotent short-circuit
    # (AC-3 of TASK-010) before touching them. `load_task_context`
    # (TASK-009/AC-2) DOES reach `get_secret`/`driver_for` though, on
    # every dispatch cycle -- both return harmless no-op values.
    async def _fake_secret(_ref: str) -> str | None:
        return "tok-fake"

    def _fake_driver(_provider: str) -> _NoAnatomyDriver:
        return _NoAnatomyDriver()

    async def _noop_audit(_conn: Any, _event: Any) -> None:
        return None

    return RepoBootstrapDeps(
        get_secret=_fake_secret, driver_for=_fake_driver, emit_audit=_noop_audit
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


async def _empty_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
    """TASK-012: pre-existing tests here don't exercise cost attribution --
    their dispatches carry no `usage`, so `record_dispatch_cost_fn` is never
    invoked. Stubbed so `run_dark_factory`'s mandatory rate-card resolution
    (AC-4) doesn't need real settings-table fixtures unrelated to what these
    tests are about.
    """
    return {}


async def _always_ok_preflight(
    _conn: Any, *, tenant_id: str, project_iri: str, run_id: str, phase: str
) -> None:
    """BE-TASK-006: pre-existing tests here don't exercise the preflight
    credential check -- stubbed as a no-op so `run_dark_factory`'s new
    mandatory preflight calls (AC-1) don't need real project/secrets
    fixtures unrelated to what these tests are about. The real wiring
    (`default_preflight`) is proven by `tests/unit/test_preflight.py` and
    `tests/integration/test_preflight_wiring.py` (named `..._wiring` --
    `test_preflight.py` collides on module basename with the unit-test
    file of the same name; pytest's rootless import mode requires unique
    basenames across `tests/unit/` and `tests/integration/`).
    """


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
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        fire_hitl_gate_fn=_fake_hitl,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
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
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
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

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_tracking_pass,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
    )
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
    # BE-TASK-006 AC-4: self_verify_fn stamps self_verification onto the
    # summary before it's persisted (default rules == [], so always []).
    expected = summary.model_copy(update={"self_verification": []})
    assert task.codify_checkpoint == expected.model_dump()

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


async def test_dispatch_one_stops_for_revision_when_self_verify_reports_violated() -> None:
    """QA edge case (BE-TASK-006 AC-5): `default_applicable_rules()` is a
    structural no-op today (ADR-018), so this path never fires in
    production yet -- but the *wiring* in `_dispatch_one` (not just
    `self_verify()` in isolation, already covered by
    `test_self_verify.py`) must still fail closed the moment a rule
    registry starts returning entries. Injects `applicable_rules_fn`/
    `self_verify_fn` via `OrchestratorDeps` to simulate that future state
    and asserts the task lands on `"revision"`, never `"Done"`.
    """
    summary = DepSummary(task_id="t1", decisions=["chose X"], outputs=["a.py"])

    async def _pass_with_summary(
        conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> Any:
        return TypedResult(status="PASS", retry_recommended=False), summary

    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_pass_with_summary,
        applicable_rules_fn=lambda: ["some-rule"],
        self_verify_fn=lambda _self_verification, _rules: self_verify(None, ["some-rule"]),
    )

    await _dispatch_one(conn, spine, task, tenant_id=_TENANT, deps=deps)

    assert task.status == "revision"
    assert task.status != "Done"


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


async def test_ac2_anatomy_loaded_into_task_context_before_delegate() -> None:
    """AC-2: `should load anatomy into task context before delegate` --
    `_dispatch_one` calls `load_task_context` (task brief pseudocode)
    before `dispatch_pdac_fn` (the PLAN->DELEGATE->ASSESS->CODIFY cycle),
    so a `scm_driver.read` hit on the repo's `ANATOMY.md` lands in
    `task.context` before DELEGATE ever runs -- not just that the field
    exists, but that real content flows through it.
    """
    anatomy_md = "# Repository Anatomy\n\n| Area | Files | Wiki |\n|---|---|---|\n"

    class _AnatomyDriver:
        """Only `read_file` is reachable via `load_task_context` -- the rest
        are `NotImplementedError` stubs purely to satisfy `ScmDriver`."""

        async def create_repo(self, *, name: str, private: bool, token: str) -> RepoHandle:
            raise NotImplementedError

        async def write_initial_commit(
            self, repo: RepoHandle, *, boilerplate: dict[str, str], token: str
        ) -> None:
            raise NotImplementedError

        async def commit_workspace(
            self, repo: RepoHandle, *, workspace: str, branch: str, message: str, token: str
        ) -> str:
            raise NotImplementedError

        async def apply_branch_protection(self, repo: RepoHandle, *, token: str) -> None:
            raise NotImplementedError

        async def commit_files(
            self, repo: RepoHandle, *, files: dict[str, str], message: str, token: str
        ) -> str:
            raise NotImplementedError

        async def read_file(self, repo: RepoHandle, *, path: str, token: str) -> str | None:
            assert path == "ANATOMY.md"
            return anatomy_md

    async def _fake_secret(_ref: str) -> str | None:
        return "tok-fake"

    async def _noop_audit(_conn: Any, _event: Any) -> None:
        return None

    seen_context: list[str] = []

    async def _capture_context(
        _conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> tuple[TypedResult, Any]:
        seen_context.extend(task.context)
        return TypedResult(status="PASS", retry_recommended=False), DepSummary(task_id=task.id)

    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection(dep_summary_row={"task_id": "t1"})
    deps = OrchestratorDeps(
        repo_deps=RepoBootstrapDeps(
            get_secret=_fake_secret,
            driver_for=lambda _provider: _AnatomyDriver(),
            emit_audit=_noop_audit,
        ),
        dispatch_pdac_fn=_capture_context,
    )

    await _dispatch_one(conn, spine, task, tenant_id=_TENANT, deps=deps)

    assert task.context == [anatomy_md]
    assert seen_context == [anatomy_md], "AC-2: DELEGATE must see the anatomy already loaded"


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
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        fire_hitl_gate_fn=_fake_hitl,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
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
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
    )

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


async def test_persist_one_cost_event_per_agent_dispatch() -> None:
    """TASK-012 AC-1: a dispatch returning a usage block persists one
    `cost_events` row -- proven through the real dispatch loop (the wrap
    point in `_dispatch_one`), not a mocked call.
    """
    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()
    usage = DispatchUsage(
        agent_role="delegate", model="claude-sonnet-5", tokens_in=1000, tokens_out=500
    )

    async def _dispatch_with_usage(
        _conn: Any, *, tenant_id: str, project_iri: str, task: TaskState
    ) -> Any:
        return (
            TypedResult(status="PASS", retry_recommended=False, usage=usage),
            DepSummary(task_id=task.id),
        )

    async def _stub_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
        return {
            "claude-sonnet-5": ModelRate(
                usd_per_1k_in=Decimal("0.003"), usd_per_1k_out=Decimal("0.015")
            )
        }

    emitted: list[Any] = []

    async def _stub_emit(ctx: Any, _usage: Any, _cost: Any) -> None:
        emitted.append(ctx)

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_dispatch_with_usage,
        resolve_rate_card_fn=_stub_rate_card,
        record_dispatch_cost_fn=functools.partial(record_dispatch_cost, emit_billing_fn=_stub_emit),
        preflight_fn=_always_ok_preflight,
    )

    await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    cost_inserts = [row for row in conn.executed if "INSERT INTO cost_events" in row[0]]
    assert len(cost_inserts) == 1
    _query, args = cost_inserts[0]
    assert args == (
        _TENANT, _PROJECT_IRI, "t1", "run-1", "delegate", "claude-sonnet-5", 1000, 500,
        Decimal("0.0105"),
    )
    assert len(emitted) == 1


async def test_default_dispatch_pdac_stub_records_no_cost_event() -> None:
    """No token spend for the current no-op PDAC stub (TASK-007/008 not yet
    built) -- `usage` stays `None`, so the wrap point never fabricates a row.
    """
    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()

    async def _stub_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
        return {}

    def _unreachable_cost_recorder(*_a: Any, **_kw: Any) -> Any:
        raise AssertionError("no usage on the result -- cost recorder must not be invoked")

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        resolve_rate_card_fn=_stub_rate_card,
        record_dispatch_cost_fn=_unreachable_cost_recorder,
        preflight_fn=_always_ok_preflight,
    )

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.dispatch_count == 1
    assert result.tasks[0].status == "Done"


async def test_halt_run_at_start_when_rate_card_unresolvable() -> None:
    """TASK-012 AC-4: a rate-card config error halts the RUN before any
    dispatch -- zero dispatch cycles, HITL fired, halted phase persisted --
    the same fail-closed posture as the model-routing halt, but run-scoped.
    """
    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()
    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    async def _boom_rate_card(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
        raise RateCardConfigError(frozenset({"claude-fable-5"}))

    async def _unreachable_dispatch(*_a: Any, **_kw: Any) -> Any:
        raise AssertionError("no dispatch should run when the rate card is unresolvable")

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_unreachable_dispatch,
        resolve_rate_card_fn=_boom_rate_card,
        fire_hitl_gate_fn=_fake_hitl,
    )

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.dispatch_count == 0
    assert result.phase == "halted_config_error"
    assert len(hitl_calls) == 1
    assert task.status == "Queued"


async def test_halt_run_at_next_checkpoint_when_budget_cascade_breached() -> None:
    """TASK-013 AC-4: the budget check runs beside the existing turn-cap
    checkpoint, right after each dispatch commits -- a breach halts before
    the next task dispatches, never invented as a second checkpoint concept.
    """
    task1 = TaskState(id="t1", status="Queued")
    task2 = TaskState(id="t2", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task1, task2])
    conn = _FakeConnection()
    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    async def _breach(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
        return BudgetBreach(cap_usd=Decimal("10"), spent_usd=Decimal("12"), level="domain")

    notify_calls: list[Any] = []

    async def _fake_notify(_conn: Any, *, tenant_id: str, project_iri: str, breach: Any) -> None:
        notify_calls.append(breach)

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        fire_hitl_gate_fn=_fake_hitl,
        resolve_rate_card_fn=_empty_rate_card,
        check_budget_fn=_breach,
        notify_budget_breach_fn=_fake_notify,
        preflight_fn=_always_ok_preflight,
    )

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.dispatch_count == 1
    assert result.phase == "halted_budget_breach"
    assert result.tasks[0].status == "Done"
    assert result.tasks[1].status == "Queued"  # never dispatched
    assert len(hitl_calls) == 1
    assert hitl_calls[0].evidence == "budget_breach_at_domain"
    assert len(notify_calls) == 1


async def test_stay_halted_when_budget_notify_emit_fails() -> None:
    """TASK-013 AC-5: a `PLAT-NOTIFY-1` emit failure never un-halts the run
    -- the halted phase is already committed before the best-effort notify.
    """
    task = TaskState(id="t1", status="Queued")
    spine = _spine(turn_cap=10, tasks=[task])
    conn = _FakeConnection()

    async def _breach(_conn: Any, *, tenant_id: str, project_iri: str) -> Any:
        return BudgetBreach(cap_usd=Decimal("10"), spent_usd=Decimal("12"), level="company")

    async def _boom_notify(_conn: Any, *, tenant_id: str, project_iri: str, breach: Any) -> None:
        raise ConnectionError("notify pipeline unreachable")

    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        resolve_rate_card_fn=_empty_rate_card,
        check_budget_fn=_breach,
        notify_budget_breach_fn=_boom_notify,
        preflight_fn=_always_ok_preflight,
    )

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.phase == "halted_budget_breach"


async def test_scaffold_failure_halts_naming_the_step(monkeypatch: pytest.MonkeyPatch) -> None:
    """AC-8: a rich-scaffold step failure halts the run fail-closed and
    names the failing step in the HITL evidence trail -- no feature task
    is ever dispatched.
    """

    async def _boom_scaffold(_conn: Any, *, project_iri: str, tenant_id: str, deps: Any) -> None:
        raise ScaffoldFailed("branch_protection", RuntimeError("scm rejected request"))

    monkeypatch.setattr(orchestrator_module, "rich_scaffold", _boom_scaffold)

    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    spine = _spine(turn_cap=10, tasks=[TaskState(id="t1", status="Queued")])
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        fire_hitl_gate_fn=_fake_hitl,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
    )
    conn = _FakeConnection()

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.phase == "halted_hitl"
    assert result.dispatch_count == 0
    assert result.tasks[0].status == "Queued"  # never dispatched
    assert len(hitl_calls) == 1
    assert hitl_calls[0].evidence == "scaffold_step_failed:branch_protection"


async def test_env_verification_pending_holds_all_feature_dispatch() -> None:
    """AC-7: a freshly-scaffolded project (`feature_dispatch_held = True`,
    the env-verification gate already fired inside `rich_scaffold`) halts
    the run before the dispatch loop -- no feature task runs while the
    hold is in place, and no second HITL gate is fired here (the gate was
    already fired by `rich_scaffold` itself).
    """
    hitl_calls: list[HitlGateContext] = []

    async def _fake_hitl(_conn: Any, ctx: HitlGateContext, **_kw: Any) -> None:
        hitl_calls.append(ctx)

    spine = _spine(turn_cap=10, tasks=[TaskState(id="t1", status="Queued")])
    deps = OrchestratorDeps(
        repo_deps=_repo_deps(),
        dispatch_pdac_fn=_always_pass,
        fire_hitl_gate_fn=_fake_hitl,
        resolve_rate_card_fn=_empty_rate_card,
        preflight_fn=_always_ok_preflight,
    )
    conn = _FakeConnection(repo_row={**_REPO_ROW, "feature_dispatch_held": True})

    result = await run_dark_factory(conn, spine, tenant_id=_TENANT, deps=deps)

    assert result.phase == "halted_hitl"
    assert result.dispatch_count == 0
    assert result.tasks[0].status == "Queued"  # never dispatched
    assert len(hitl_calls) == 0  # already fired inside rich_scaffold, not re-fired here
