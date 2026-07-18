"""G12 (docs/design/remediation-2-api-gaps.md): pending-HITL-gate list
derivation. Blocked (`TaskState.status == "Blocked"`) is the same
HITL-escalation signal `build.board.lane_for_status`/`hitl_escalated`
already reads -- reused here, not redefined, so this can never drift from
what the board shows for the same task. No per-task gate-type (DoR vs DoD
vs pre-scaffold) is captured in the state spine, so `gate` is the generic
`"hitl"` literal -- documented deferral, same posture as G9/G10's missing
timestamps.
"""

from __future__ import annotations

from weave_backend.build.pending_gates import build_pending_gates
from weave_backend.build.state_spine import StateSpine, TaskState

_PROJECT_IRI = "urn:weave:project:t1:acme"


def _spine(tasks: list[TaskState]) -> StateSpine:
    return StateSpine(
        project_iri=_PROJECT_IRI, tenant_id="t1", run_id="r1", turn_cap=60, tasks=tasks
    )


def test_blocked_task_appears_in_pending_gates() -> None:
    spine = _spine([TaskState(id="t-1", status="Blocked")])

    result = build_pending_gates(spine)

    assert len(result.gates) == 1
    entry = result.gates[0]
    assert entry.task_id == "t-1"
    assert entry.gate == "hitl"


def test_non_blocked_task_is_excluded() -> None:
    spine = _spine([TaskState(id="t-1", status="Ready"), TaskState(id="t-2", status="Done")])

    result = build_pending_gates(spine)

    assert result.gates == []


def test_evidence_refs_point_at_the_four_task_sub_routes_plus_hitl_action() -> None:
    spine = _spine([TaskState(id="t-1", status="Blocked")])

    result = build_pending_gates(spine)

    evidence = result.gates[0].evidence
    base = f"/api/projects/{_PROJECT_IRI}/tasks/t-1"
    assert evidence.task_detail == base
    assert evidence.audit == f"{base}/audit"
    assert evidence.console_log == f"{base}/console-log"
    assert evidence.captures == f"{base}/captures"
    assert evidence.hitl_action == "/api/tasks/t-1/hitl"


def test_no_blocked_tasks_returns_empty_list() -> None:
    spine = _spine([])

    result = build_pending_gates(spine)

    assert result.gates == []
    assert result.project_iri == _PROJECT_IRI
