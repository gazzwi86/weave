"""BE-TASK-008 (build-engine EPIC-012): the spec-coverage audit (FR-053,
AC-5) -- the `coverage_audit` step of the phase-gate ceremony
(`ceremony.py`).

Design Decisions (task brief + ADR-017):
- No FR/NFR priority registry exists on the persisted `TaskBrief` (no
  `priority` field on `EarsAC`) -- every AC in every in-scope task brief is
  treated as a Must requirement (Implementation Hints give no narrower
  model; the brief's own "ambiguous = MISSING" philosophy is to err
  stricter/more-inclusive, never looser).
- `find_evidence`/`classify` reuse the exact AC<->test mapping the QA
  suite's `_run_ac_mapping` already reads (`ac_to_test_map`, `test_names`)
  -- same project-derived-facts discipline as `qa_suite.QAProject`, just a
  tri-state verdict instead of a binary pass/fail.
- Ambiguous = MISSING: no mapping row at all defaults down, never up.
"""

from __future__ import annotations

from typing import Any

from weave_backend.build.qa_suite import QAProject

_DELIVERED_THRESHOLD = 0.90


def _classify(ac_id: str | None, mapping: dict[str, str | None], test_names: frozenset[str]) -> str:
    """Implementation Hints: "no exact AC<->test row AND no unambiguous code
    ref => MISSING"; a mapped-but-not-in-tree test is a code-only match --
    PARTIAL, never DELIVERED.
    """
    test_name = mapping.get(ac_id) if ac_id else None
    if not test_name:
        return "MISSING"
    if test_name in test_names:
        return "DELIVERED"
    return "PARTIAL"


def _rows_for_project(project: QAProject) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for brief in project.task_briefs:
        mapping = {m.get("ac_id"): m.get("test_name") for m in brief.get("ac_to_test_map") or []}
        for ac in brief.get("acceptance_criteria") or []:
            ac_id = ac.get("id")
            status = _classify(ac_id, mapping, project.test_names)
            rows.append({"requirement": ac_id, "status": status, "evidence": mapping.get(ac_id)})
    return rows


def run_spec_coverage_audit(project: QAProject) -> tuple[str, dict[str, Any]]:
    """AC-5: every Must requirement (every AC, per the design decision
    above) -> DELIVERED/PARTIAL/MISSING; halts below 90% delivered or on
    any MISSING row. No requirements in scope is vacuously ok (nothing to
    violate) -- an edge case the brief's pseudocode doesn't cover, kept
    conservative (`ok=True`) rather than invented as a failure.
    """
    rows = _rows_for_project(project)
    if not rows:
        return "passed", {"rows": [], "delivered_pct": 1.0}

    delivered_pct = sum(1 for r in rows if r["status"] == "DELIVERED") / len(rows)
    ok = delivered_pct >= _DELIVERED_THRESHOLD and not any(r["status"] == "MISSING" for r in rows)
    verdict = "passed" if ok else "halt"
    return verdict, {"rows": rows, "delivered_pct": delivered_pct}
