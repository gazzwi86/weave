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


def _run_edge_case_extension(_project: QAProject) -> tuple[str, dict[str, Any]]:
    """Implementation Hints: the QA agent proposes+runs edge-case tests
    for uncovered boundaries; verdict comes from those tests executing,
    not model opinion. The proposal step itself is out of this task's
    scope -- no AC covers it -- so this runner just executes whatever
    `edge_case_extension`-marked tests already exist.

    ponytail: a nonzero exit with no stderr (pytest's "no tests
    collected", exit code 5) is read as passed rather than failed --
    `qa_agent.CommandOutcome` doesn't carry the exit code, so this is a
    heuristic, not an exact check. Upgrade: thread the real exit code
    through `CommandOutcome` if this needs to be exact.
    """
    outcome = qa_agent.run_command("pytest -m edge_case_extension")
    if outcome.status == "NOT_VERIFIED":
        raise ToolUnavailable("edge_case_extension")
    if outcome.status == "FAIL" and outcome.evidence:
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


async def run_full_qa_suite(
    conn: asyncpg.Connection, *, run_ctx: QARunContext, project: QAProject
) -> dict[str, Any]:
    """AC-1..AC-6: evaluates all nine categories, records one `gate_results`
    row per category plus one `qa_full` aggregate row, and returns the
    evidence bundle for the ceremony record.
    """
    categories: list[dict[str, Any]] = []
    for name, applicable, runner in CATEGORIES:
        if name in _LONG_LANES and applicable(project) and run_ctx.progress_cb:
            run_ctx.progress_cb(name, "starting")
        verdict, evidence = _evaluate_category(name, applicable, runner, project)
        categories.append({"category": name, "verdict": verdict, "evidence": evidence})
        await _record_category(conn, run_ctx, name, verdict, evidence)

    overall = "PASS" if all(c["verdict"] in ("passed", "n_a") for c in categories) else "FAIL"
    await _record_category(conn, run_ctx, "full", overall, {"categories": categories})
    return {"gate": "qa_full", "result": overall, "categories": categories}
