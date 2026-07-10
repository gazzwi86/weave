"""BE-TASK-007 (build-engine EPIC-012) unit tests: `qa_suite.run_full_qa_suite`
-- the nine-category QA suite the phase-gate ceremony (TASK-008) invokes.
DB/audit collaborators patched at the `gates` module boundary (same
`record_gate`/`gate_store` seam `test_build_gates.py` proves for M1's
DoR/DoD/pre-scaffold gates) -- this suite reuses that exact seam rather
than duplicating the audit+persist pairing.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

from weave_backend.build.gate_store import NewGateResult
from weave_backend.build.qa_agent import CommandOutcome
from weave_backend.build.qa_suite import QAProject, QARunContext, run_full_qa_suite

_RUN_CTX = QARunContext(
    tenant_id="tenant-qa",
    actor_iri="urn:weave:principal:user:u-1",
    project_iri="urn:weave:project:tenant-qa:acme",
)


def _category(result: dict[str, Any], name: str) -> dict[str, Any]:
    return next(c for c in result["categories"] if c["category"] == name)


async def test_qa_suite_marks_not_verified_and_fails_suite_when_category_unavailable() -> None:
    def _fake_run_command(cmd: str) -> CommandOutcome:
        if cmd.startswith("mutmut"):
            return CommandOutcome(status="NOT_VERIFIED", evidence="binary not found")
        return CommandOutcome(status="PASS")

    project = QAProject(has_ui=False, slo=None)
    with (
        patch("weave_backend.build.qa_suite.qa_agent.run_command", side_effect=_fake_run_command),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    assert result["result"] == "FAIL"
    mutation = _category(result, "delta_mutation")
    assert mutation["verdict"] == "not_verified"


async def test_qa_suite_marks_a11y_na_with_reason_for_headless_project() -> None:
    project = QAProject(has_ui=False, slo=None)
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    a11y = _category(result, "a11y")
    browser = _category(result, "browser_backend")
    assert a11y["verdict"] == "n_a"
    assert a11y["evidence"]["reason"]
    assert browser["verdict"] == "n_a"
    assert result["result"] == "PASS"


async def test_qa_suite_fails_ac_mapping_listing_unmapped_ac_ids() -> None:
    project = QAProject(
        has_ui=False,
        slo=None,
        task_briefs=(
            {
                "acceptance_criteria": [{"id": "AC-1"}, {"id": "AC-2"}],
                "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_thing"}],
            },
        ),
        test_names=frozenset({"test_thing"}),
    )
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    mapping = _category(result, "ac_test_mapping")
    assert mapping["verdict"] == "failed"
    assert mapping["evidence"]["unmapped_ac_ids"] == ["AC-2"]
    assert result["result"] == "FAIL"


async def test_qa_suite_fails_browser_category_without_backend_assertion() -> None:
    project = QAProject(
        has_ui=True, slo=None, browser_result={"passed": True, "backend_assertions": 0}
    )
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    browser = _category(result, "browser_backend")
    assert browser["verdict"] == "failed"
    assert result["result"] == "FAIL"


async def test_qa_suite_browser_category_not_verified_when_no_result_recorded() -> None:
    """Coverage for the `browser_result is None` branch of AC-5's runner."""
    project = QAProject(has_ui=True, slo=None, browser_result=None)
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    browser = _category(result, "browser_backend")
    assert browser["verdict"] == "not_verified"
    assert result["result"] == "FAIL"


async def test_qa_suite_fails_perf_category_over_budget() -> None:
    """Coverage for `run_perf_vs_slo`'s over-budget branch."""
    project = QAProject(has_ui=False, slo={"measured_ms": 300, "budget_ms": 200})
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    perf = _category(result, "perf")
    assert perf["verdict"] == "failed"
    assert result["result"] == "FAIL"


async def test_qa_suite_perf_category_not_verified_when_slo_missing_measurement() -> None:
    """Coverage for `_run_perf_vs_slo`'s NOT_VERIFIED branch -- an SLO is
    declared but no measurement was ever taken (`measured_ms`/`budget_ms`
    absent), so the category can't be verified rather than silently
    passing or failing.
    """
    project = QAProject(has_ui=False, slo={})
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    perf = _category(result, "perf")
    assert perf["verdict"] == "not_verified"
    assert result["result"] == "FAIL"


async def test_qa_suite_fails_browser_category_when_playwright_run_failed() -> None:
    """Coverage for `_run_browser_backend`'s `passed is False` branch --
    distinct from the "ran fine but no backend assertion" branch already
    covered above.
    """
    project = QAProject(
        has_ui=True, slo=None, browser_result={"passed": False, "backend_assertions": 3}
    )
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    browser = _category(result, "browser_backend")
    assert browser["verdict"] == "failed"
    assert browser["evidence"]["reason"] == "playwright_run_failed"
    assert result["result"] == "FAIL"


async def test_qa_suite_fails_lint_category_on_nonzero_exit() -> None:
    """Coverage for `_cmd_runner`'s FAIL branch."""

    def _fake_run_command(cmd: str) -> CommandOutcome:
        if cmd.startswith("ruff check .") and "C901" not in cmd:
            return CommandOutcome(status="FAIL", evidence="lint error")
        return CommandOutcome(status="PASS")

    project = QAProject(has_ui=False, slo=None)
    with (
        patch("weave_backend.build.qa_suite.qa_agent.run_command", side_effect=_fake_run_command),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    lint = _category(result, "lint")
    assert lint["verdict"] == "failed"
    assert result["result"] == "FAIL"


async def test_qa_suite_aggregates_pass_with_evidence_bundle() -> None:
    project = QAProject(
        has_ui=True,
        slo={"measured_ms": 100, "budget_ms": 200},
        browser_result={"passed": True, "backend_assertions": 1},
    )
    mock_emit = AsyncMock()
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", mock_emit),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    assert result["result"] == "PASS"
    assert len(result["categories"]) == 9
    # 9 categories + 1 aggregate gate row each emit to the audit chain.
    assert mock_emit.await_count == 10


async def test_qa_suite_streams_progress_for_long_lanes() -> None:
    """AC-1 + Suite budget note: long lanes (mutation, Playwright) stream
    progress to the caller-supplied sink rather than the suite owning its
    own run-log storage.
    """
    messages: list[tuple[str, str]] = []
    run_ctx = QARunContext(
        tenant_id="tenant-qa",
        actor_iri="urn:weave:principal:user:u-1",
        project_iri="urn:weave:project:tenant-qa:acme",
        progress_cb=lambda category, message: messages.append((category, message)),
    )
    project = QAProject(
        has_ui=True, slo=None, browser_result={"passed": True, "backend_assertions": 1}
    )
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        await run_full_qa_suite(object(), run_ctx=run_ctx, project=project)

    streamed_categories = {category for category, _ in messages}
    assert "delta_mutation" in streamed_categories
    assert "a11y" in streamed_categories


async def test_qa_suite_records_run_id_on_gate_rows() -> None:
    run_ctx = QARunContext(
        tenant_id="tenant-qa",
        actor_iri="urn:weave:principal:user:u-1",
        project_iri="urn:weave:project:tenant-qa:acme",
        run_id="run-1",
    )
    project = QAProject(has_ui=False, slo=None)
    captured: list[NewGateResult] = []

    async def _fake_insert(_conn: object, fields: NewGateResult) -> None:
        captured.append(fields)

    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", _fake_insert),
    ):
        await run_full_qa_suite(object(), run_ctx=run_ctx, project=project)

    assert all(f.run_id == "run-1" for f in captured)


async def test_qa_suite_fails_ac_mapping_when_mapped_test_name_absent_from_tree() -> None:
    """AC-4 edge case: the brief maps an AC to a test *name*, but that name
    isn't actually present in `project.test_names` (e.g. the test was
    renamed or deleted after the brief was written). The AC must still be
    reported unmapped -- a stale mapping is not a substitute for "test
    present in test tree" (distinct from the existing test's simpler
    "no mapping at all" case).
    """
    project = QAProject(
        has_ui=False,
        slo=None,
        task_briefs=(
            {
                "acceptance_criteria": [{"id": "AC-1"}],
                "ac_to_test_map": [{"ac_id": "AC-1", "test_name": "test_renamed_away"}],
            },
        ),
        test_names=frozenset({"test_thing"}),  # note: does not contain "test_renamed_away"
    )
    with (
        patch(
            "weave_backend.build.qa_suite.qa_agent.run_command",
            return_value=CommandOutcome(status="PASS"),
        ),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    mapping = _category(result, "ac_test_mapping")
    assert mapping["verdict"] == "failed"
    assert mapping["evidence"]["unmapped_ac_ids"] == ["AC-1"]


async def test_qa_suite_edge_case_extension_must_not_pass_a_genuine_test_failure() -> None:
    """QA finding TASK-007-F1 (logic): `_run_edge_case_extension`'s
    evidence-empty heuristic (`ponytail:` comment in qa_suite.py) reads
    "FAIL with empty evidence" as passed, intending to cover pytest's
    "no tests collected" case (exit 5, empty stderr). But a *genuine*
    edge-case test failure has the identical shape at this layer: pytest
    reports assertion failures to stdout, not stderr, so `CommandOutcome
    .evidence` (which only captures stderr) is empty for real failures
    too -- `qa_agent.run_command` demonstrated empirically: exit 1, empty
    stderr, for `assert False`.

    This test pins the safe behaviour (a FAIL exit must never become a
    "passed" verdict) and is expected to currently FAIL against
    `_run_edge_case_extension` -- see the QA report for TASK-007. It
    should go green once the Engineer fixes the heuristic (e.g. by
    threading the real exit code through `CommandOutcome`, per the
    ponytail comment's own stated upgrade path, rather than keying off
    evidence emptiness).
    """

    def _fake_run_command(cmd: str) -> CommandOutcome:
        if cmd.startswith("pytest -m edge_case_extension"):
            # Real pytest failure shape (verified empirically): nonzero
            # exit, empty stderr -- failure detail lands on stdout, which
            # CommandOutcome does not capture.
            return CommandOutcome(status="FAIL", evidence="")
        return CommandOutcome(status="PASS")

    project = QAProject(has_ui=False, slo=None)
    with (
        patch("weave_backend.build.qa_suite.qa_agent.run_command", side_effect=_fake_run_command),
        patch("weave_backend.build.gates.default_audit_emitter.emit", AsyncMock()),
        patch("weave_backend.build.gates.gate_store.insert_gate_result", AsyncMock()),
    ):
        result = await run_full_qa_suite(object(), run_ctx=_RUN_CTX, project=project)

    edge = _category(result, "edge_case_extension")
    assert edge["verdict"] == "failed", (
        "a genuine pytest FAIL (nonzero exit) must not be silently reported "
        "as passed just because stderr happened to be empty -- TASK-007-F1"
    )
    assert result["result"] == "FAIL"
