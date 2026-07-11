"""BE-TASK-007 (build-engine EPIC-012): the full nine-category QA suite the
phase-gate ceremony (TASK-008) invokes -- extends the M1 DoD gate runner
(`gates.run_dod_gate`, FR-047) from five commands to nine categories with
per-category applicability rules (FR-054).

Design Decisions (task brief):
- `not_verified` != `n_a` -- a category whose tool can't run FAILs the
  suite; a category that doesn't apply to this project (with a recorded
  reason) does not. Conflating the two would let an absent tool hide as a
  shrug instead of a finding.
- Categories are a data table (`CATEGORIES`), not nine bespoke functions --
  same shape precedent as `gates._DOD_COMMANDS`.
- Applicability is project-derived (`QAProject`), never a manual toggle.
- The suite has no run-log storage of its own -- long lanes (mutation,
  Playwright) stream progress through the caller-supplied `progress_cb`
  on `QARunContext`; owning durable run-log storage is the ceremony's job.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import asyncpg

from weave_backend.build import qa_agent
from weave_backend.build.captures import (
    CaptureFn,
    CaptureRunContext,
    CaptureTask,
    capture_visual_states,
)
from weave_backend.build.gates import GateRecord, record_gate

#: Category names whose runner is a real, potentially slow, external
#: process -- these get a `progress_cb` ping before they run.
_LONG_LANES = frozenset({"delta_mutation", "a11y", "browser_backend"})


class ToolUnavailable(Exception):
    """Raised by a category runner when its tool can't run at all --
    caught by the suite loop and recorded as `not_verified` (AC-2), never
    silently skipped.
    """

    def __init__(self, tool: str) -> None:
        self.tool = tool
        super().__init__(tool)


@dataclass(frozen=True)
class QARunContext:
    """Grouped invocation context (Law E 5-parameter budget -- same
    grouping precedent as `gates.GateRecord`). `run_id` links every
    category/aggregate gate row back to the ceremony run that invoked the
    suite; `progress_cb(category, message)` is the caller's run-log sink.
    """

    tenant_id: str
    actor_iri: str
    project_iri: str
    run_id: str | None = None
    progress_cb: Callable[[str, str], None] | None = None
    #: AC-7: caller-supplied real S3 client + target bucket. `None` (the
    #: default, e.g. every existing headless-project test) means the
    #: captures producer never runs -- same opt-in shape as `browser_result`.
    s3_client: Any | None = None
    captures_bucket: str = "weave-artefacts"


@dataclass(frozen=True)
class QAProject:
    """Project-derived facts the suite's applicability rules and category
    runners need. Caller (the ceremony) assembles this from the generated
    project -- the suite itself never queries a DB or the filesystem
    (Design Decisions: applicability is project-derived, not config).
    """

    has_ui: bool = False
    slo: dict[str, Any] | None = None
    task_briefs: tuple[dict[str, Any], ...] = ()
    test_names: frozenset[str] = frozenset()
    browser_result: dict[str, Any] | None = None  # {"passed": bool, "backend_assertions": int}
    #: AC-7: the task's primary UI surface + the real Playwright-backed
    #: state driver. `None` capture_fn (headless projects, or a caller not
    #: yet wired for it) means no manifest is produced -- honest absence,
    #: never a fabricated one (captures.py's own contract).
    primary_surface: str = ""
    capture_fn: CaptureFn | None = None


Runner = Callable[[QAProject], tuple[str, dict[str, Any]]]
Applicable = Callable[[QAProject], bool]


def _always(_project: QAProject) -> bool:
    return True


def _ui_only(project: QAProject) -> bool:
    return project.has_ui


def _has_slo(project: QAProject) -> bool:
    return project.slo is not None


_NA_REASONS: dict[str, str] = {
    "a11y": "project has no UI packages",
    "browser_backend": "project has no UI packages",
    "perf": "no SLOs declared in project spec",
}


def _cmd_runner(tool: str, cmd: str) -> Runner:
    """Wraps a shell-command category (lint/coverage/complexity/
    delta_mutation/a11y) around `qa_agent.run_command` -- same self-run,
    no-simulation discipline as the M1 DoD gate (FR-047).
    """

    def _run(_project: QAProject) -> tuple[str, dict[str, Any]]:
        outcome = qa_agent.run_command(cmd)
        if outcome.status == "NOT_VERIFIED":
            raise ToolUnavailable(tool)
        if outcome.status == "FAIL":
            return "failed", {"evidence": outcome.evidence}
        return "passed", {}

    return _run


def _run_ac_mapping(project: QAProject) -> tuple[str, dict[str, Any]]:
    """AC-4: every AC in the project's task briefs must map to a named
    test present in the test tree; an unmapped AC lists its ID.
    """
    unmapped: list[str] = []
    for brief in project.task_briefs:
        acs = brief.get("acceptance_criteria") or []
        mapping = {m.get("ac_id"): m.get("test_name") for m in brief.get("ac_to_test_map") or []}
        for ac in acs:
            ac_id = ac.get("id")
            test_name = mapping.get(ac_id)
            if not test_name or test_name not in project.test_names:
                unmapped.append(ac_id)
    if unmapped:
        return "failed", {"unmapped_ac_ids": unmapped}
    return "passed", {}


def _run_browser_backend(project: QAProject) -> tuple[str, dict[str, Any]]:
    """AC-5 (Law B): a UI-only Playwright pass without an asserted backend
    state change is a category failure, not a pass.
    """
    result = project.browser_result
    if result is None:
        raise ToolUnavailable("playwright")
    if not result.get("passed"):
        return "failed", {"reason": "playwright_run_failed"}
    if not result.get("backend_assertions"):
        return "failed", {"reason": "no_backend_state_assertion"}
    return "passed", {"backend_assertions": result["backend_assertions"]}


def _run_perf_vs_slo(project: QAProject) -> tuple[str, dict[str, Any]]:
    """Only invoked when `_has_slo` is true -- absent SLOs are `n_a`
    (Implementation Hints: never invent default SLOs).
    """
    slo = project.slo or {}
    measured, budget = slo.get("measured_ms"), slo.get("budget_ms")
    if measured is None or budget is None:
        raise ToolUnavailable("perf_measurement")
    verdict = "failed" if measured > budget else "passed"
    return verdict, {"measured_ms": measured, "budget_ms": budget}


_PYTEST_NO_TESTS_COLLECTED = 5


def _run_edge_case_extension(_project: QAProject) -> tuple[str, dict[str, Any]]:
    """Implementation Hints: the QA agent proposes+runs edge-case tests
    for uncovered boundaries; verdict comes from those tests executing,
    not model opinion. The proposal step itself is out of this task's
    scope -- no AC covers it -- so this runner just executes whatever
    `edge_case_extension`-marked tests already exist.

    TASK-007-F1 fix: verdict is keyed off the real subprocess exit code
    (`CommandOutcome.returncode`), never off whether `evidence` happens to
    be empty -- pytest writes assertion failures to stdout, which
    `CommandOutcome` never captures, so a genuine failure and pytest's
    "no tests collected" case (exit 5) were otherwise indistinguishable.
    Exit 5 means no edge-case tests exist yet (genuinely not-yet-
    applicable) -- `n_a`, not a suite-failing verdict. Any other nonzero
    exit is a real failure.
    """
    outcome = qa_agent.run_command("pytest -m edge_case_extension")
    if outcome.status == "NOT_VERIFIED":
        raise ToolUnavailable("edge_case_extension")
    if outcome.returncode == _PYTEST_NO_TESTS_COLLECTED:
        return "n_a", {"reason": "no edge-case tests collected yet"}
    if outcome.status == "FAIL":
        return "failed", {"evidence": outcome.evidence}
    return "passed", {}


#: The nine QA categories (name, applicability, runner) -- AC-1's data
#: table. Order matches the task brief's pseudocode.
CATEGORIES: tuple[tuple[str, Applicable, Runner], ...] = (
    ("ac_test_mapping", _always, _run_ac_mapping),
    ("coverage", _always, _cmd_runner("coverage", "pytest --cov --cov-fail-under=80")),
    ("complexity", _always, _cmd_runner("complexity", "ruff check . --select C901")),
    ("lint", _always, _cmd_runner("lint", "ruff check .")),
    ("a11y", _ui_only, _cmd_runner("a11y", "playwright test --grep @a11y")),
    ("perf", _has_slo, _run_perf_vs_slo),
    ("browser_backend", _ui_only, _run_browser_backend),
    ("delta_mutation", _always, _cmd_runner("delta_mutation", "mutmut run --use-coverage")),
    ("edge_case_extension", _always, _run_edge_case_extension),
)


def _evaluate_category(
    name: str, applicable: Applicable, runner: Runner, project: QAProject
) -> tuple[str, dict[str, Any]]:
    if not applicable(project):
        return "n_a", {"reason": _NA_REASONS.get(name, "not applicable to this project")}
    try:
        return runner(project)
    except ToolUnavailable as exc:
        return "not_verified", {"tool": exc.tool}


async def _record_category(
    conn: asyncpg.Connection, ctx: QARunContext, name: str, verdict: str, evidence: dict[str, Any]
) -> None:
    await record_gate(
        conn,
        GateRecord(
            tenant_id=ctx.tenant_id,
            actor_iri=ctx.actor_iri,
            event_type=f"gate_result_qa_{name}",
            subject_iri=ctx.project_iri,
            gate=f"qa_{name}",
            result=verdict,
            payload=evidence,
            project_iri=ctx.project_iri,
            run_id=ctx.run_id,
        ),
    )


async def _maybe_capture_visual_states(
    run_ctx: QARunContext, project: QAProject, browser_verdict: str
) -> None:
    """BE-V1-TASK-018 AC-7: rides the `browser_backend` Playwright lane --
    runs once that lane actually passes for a UI-bearing project, never for
    a headless one (`browser_verdict` is only ever `"passed"` when
    `_ui_only` let the lane run at all). A capture producer crash never
    affects the ASSESS verdict (`captures.py`'s own posture), so this is a
    side effect, not a `CATEGORIES` entry.
    """
    if browser_verdict != "passed" or project.capture_fn is None or run_ctx.s3_client is None:
        return
    ctx = CaptureRunContext(
        tenant_id=run_ctx.tenant_id,
        run_id=run_ctx.run_id or "",
        s3_client=run_ctx.s3_client,
        bucket=run_ctx.captures_bucket,
    )
    task = CaptureTask(has_ui_surface=project.has_ui, primary_surface=project.primary_surface)
    await capture_visual_states(ctx, task, project.capture_fn)


async def run_full_qa_suite(
    conn: asyncpg.Connection, *, run_ctx: QARunContext, project: QAProject
) -> dict[str, Any]:
    """AC-1..AC-6: evaluates all nine categories, records one `gate_results`
    row per category plus one `qa_full` aggregate row, and returns the
    evidence bundle for the ceremony record. AC-7: once `browser_backend`
    passes, also drives the 8-state visual-capture producer (see
    `_maybe_capture_visual_states`).
    """
    categories: list[dict[str, Any]] = []
    browser_verdict = "n_a"
    for name, applicable, runner in CATEGORIES:
        if name in _LONG_LANES and applicable(project) and run_ctx.progress_cb:
            run_ctx.progress_cb(name, "starting")
        verdict, evidence = _evaluate_category(name, applicable, runner, project)
        categories.append({"category": name, "verdict": verdict, "evidence": evidence})
        await _record_category(conn, run_ctx, name, verdict, evidence)
        if name == "browser_backend":
            browser_verdict = verdict

    await _maybe_capture_visual_states(run_ctx, project, browser_verdict)

    overall = "PASS" if all(c["verdict"] in ("passed", "n_a") for c in categories) else "FAIL"
    await _record_category(conn, run_ctx, "full", overall, {"categories": categories})
    return {"gate": "qa_full", "result": overall, "categories": categories}
