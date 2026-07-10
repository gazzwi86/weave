"""AC-5: the spec-coverage audit's DELIVERED/PARTIAL/MISSING classification
and 90%-delivered halt rule (BE-TASK-008, build-engine EPIC-012).
"""

from __future__ import annotations

from typing import Any

from weave_backend.build.qa_suite import QAProject
from weave_backend.build.spec_coverage import run_spec_coverage_audit


def _brief(ac_ids: list[str], mapping: dict[str, str]) -> dict[str, Any]:
    return {
        "acceptance_criteria": [{"id": ac_id} for ac_id in ac_ids],
        "ac_to_test_map": [{"ac_id": ac_id, "test_name": name} for ac_id, name in mapping.items()],
    }


def test_should_mark_ambiguous_coverage_item_missing_and_halt_below_90_percent() -> None:
    """AC-5: an AC with no mapping row at all is MISSING (ambiguous defaults
    down), and any MISSING row halts regardless of the delivered ratio.
    """
    project = QAProject(
        task_briefs=(_brief(["AC-1", "AC-2"], {"AC-1": "test_one"}),),
        test_names=frozenset({"test_one"}),
    )

    verdict, evidence = run_spec_coverage_audit(project)

    assert verdict == "halt"
    rows_by_id = {r["requirement"]: r["status"] for r in evidence["rows"]}
    assert rows_by_id["AC-2"] == "MISSING"


def test_should_classify_partial_evidence_as_partial_not_delivered() -> None:
    """A mapped AC whose named test isn't in the test tree is a code-only
    match -- PARTIAL, never DELIVERED (Implementation Hints).
    """
    project = QAProject(
        task_briefs=(_brief(["AC-1"], {"AC-1": "test_not_in_tree"}),),
        test_names=frozenset(),
    )

    verdict, evidence = run_spec_coverage_audit(project)

    assert evidence["rows"][0]["status"] == "PARTIAL"
    assert verdict == "halt"  # PARTIAL isn't DELIVERED, so 0% delivered < 90%


def test_should_compute_delivered_percentage_over_must_requirements_only() -> None:
    """Every AC in an in-scope brief is a Must requirement (no priority
    registry exists) -- delivered_pct is DELIVERED rows / total rows.
    """
    project = QAProject(
        task_briefs=(
            _brief(["AC-1", "AC-2", "AC-3"], {"AC-1": "t1", "AC-2": "t2", "AC-3": "t3"}),
        ),
        test_names=frozenset({"t1", "t2"}),
    )

    verdict, evidence = run_spec_coverage_audit(project)

    assert evidence["delivered_pct"] == 2 / 3
    assert verdict == "halt"  # below the 90% threshold


def test_should_pass_when_all_delivered_at_or_above_threshold() -> None:
    project = QAProject(
        task_briefs=(_brief(["AC-1", "AC-2"], {"AC-1": "t1", "AC-2": "t2"}),),
        test_names=frozenset({"t1", "t2"}),
    )

    verdict, evidence = run_spec_coverage_audit(project)

    assert verdict == "passed"
    assert evidence["delivered_pct"] == 1.0


def test_should_pass_vacuously_when_no_requirements_in_scope() -> None:
    project = QAProject(task_briefs=(), test_names=frozenset())

    verdict, evidence = run_spec_coverage_audit(project)

    assert verdict == "passed"
    assert evidence == {"rows": [], "delivered_pct": 1.0}
