"""G12 (docs/design/remediation-2-api-gaps.md): pending-HITL-gate list for
`GET /api/projects/{project_iri}/gates?status=pending`.

`TaskState.status == "Blocked"` is the sole HITL-escalation signal in the
M1 state spine (`orchestrator._dispatch_one` sets it when
`fire_hitl_gate`'s outcome is `"hitl_gate"`) -- the same status
`build.board.lane_for_status`/`hitl_escalated` already read, reused here
rather than redefined so this view can never drift from the board. No
per-task gate-type is captured, so every entry's `gate` is the generic
`"hitl"` literal (documented deferral, not a fabricated distinction).
"""

from __future__ import annotations

from weave_backend.build.state_spine import StateSpine
from weave_backend.schemas.gates import PendingGateEntry, PendingGateEvidence, PendingGatesResponse

_HITL_ESCALATED_STATUS = "Blocked"


def _evidence_refs(project_iri: str, task_id: str) -> PendingGateEvidence:
    base = f"/api/projects/{project_iri}/tasks/{task_id}"
    return PendingGateEvidence(
        task_detail=base,
        audit=f"{base}/audit",
        console_log=f"{base}/console-log",
        captures=f"{base}/captures",
        hitl_action=f"/api/tasks/{task_id}/hitl",
    )


def build_pending_gates(spine: StateSpine) -> PendingGatesResponse:
    entries = [
        PendingGateEntry(
            task_id=task.id,
            gate="hitl",
            evidence=_evidence_refs(spine.project_iri, task.id),
        )
        for task in spine.tasks
        if task.status == _HITL_ESCALATED_STATUS
    ]
    return PendingGatesResponse(project_iri=spine.project_iri, gates=entries)
