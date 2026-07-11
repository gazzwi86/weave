"""FR-015/016/017 (BE-V1-TASK-017, build-engine EPIC-004): six-lane board
and dependency task-tree, read-only views over the M1 state spine
(`state_spine.py`, FR-044's `build_tasks` alias -- see ADR for the
spec-name-vs-implementation mapping) joined with E6-S3 retry-taxonomy data
from the ephemeral task store (`build/store.py`). Display only -- adds no
new persisted run state.
"""

from __future__ import annotations

from weave_backend.build import store
from weave_backend.build.state_spine import StateSpine, TaskState
from weave_backend.build.typed_result import DEFAULT_RETRY_CEILINGS
from weave_backend.schemas.board import (
    BoardCard,
    BoardResponse,
    TaskTreeNode,
    TaskTreeResponse,
)

#: AC-1: the six fixed lanes, in board-column order. "In Progress" is
#: structurally always empty in M1 -- no `TaskState.status` value maps to a
#: persisted mid-dispatch state (this task is display-only, no new run
#: state).
LANE_ORDER: tuple[str, ...] = ("Backlog", "Ready", "In Progress", "Review", "QA", "Done")

#: `TaskState.status` -> board lane (ADR, this task). `Blocked`
#: (HITL-escalation ceiling hit, `orchestrator._dispatch_one`) reads as
#: "Review" -- a human needs to look at it. `revision` (self-verify found a
#: violated rule, TASK-006 AC-5) reads as "QA" -- it failed the compliance
#: check and needs rework. Total mapping via `lane_for_status`'s default:
#: any status not listed here falls back to "Backlog" rather than being
#: dropped, same "flag don't drop" spirit as AC-3's orphan handling.
LANE_OF_STATUS: dict[str, str] = {
    "Queued": "Backlog",
    "Ready": "Ready",
    "Blocked": "Review",
    "revision": "QA",
    "Done": "Done",
}


def lane_for_status(status: str) -> str:
    return LANE_OF_STATUS.get(status, "Backlog")


def _retry_info(tenant_id: str, task_id: str) -> tuple[str | None, int | None, int | None]:
    """AC-2: best-effort join against the ephemeral, process-local task
    store (ADR -- same limitation `typed_result.py`'s retry bookkeeping
    already carries: not durable, not multi-process-safe in M1). Picks the
    failure class with the most recorded retries for this task as the
    "current" one to display. Ceiling comes from the static
    `DEFAULT_RETRY_CEILINGS` table -- a per-project `PLAT-SETTINGS-1`
    override would need an async DB call this read-mostly board endpoint
    does not make; flagged in the ADR, not built here.
    """
    record = store.get_task(tenant_id, task_id)
    if record is None or not record.retry_counts:
        return None, None, None
    failure_class = max(record.retry_counts, key=lambda k: record.retry_counts[k])
    attempt = record.retry_counts[failure_class]
    ceiling = DEFAULT_RETRY_CEILINGS.get(failure_class, attempt)
    return failure_class, attempt, ceiling


def _card_for_task(tenant_id: str, task: TaskState) -> BoardCard:
    failure_class, attempt, ceiling = _retry_info(tenant_id, task.id)
    return BoardCard(
        id=task.id,
        status=task.status,
        lane=lane_for_status(task.status),
        failure_class=failure_class,
        retry_attempt=attempt,
        retry_ceiling=ceiling,
        hitl_escalated=task.status == "Blocked",
    )


def build_board(spine: StateSpine) -> BoardResponse:
    cards = [_card_for_task(spine.tenant_id, task) for task in spine.tasks]
    return BoardResponse(project_iri=spine.project_iri, lanes=list(LANE_ORDER), cards=cards)


def build_task_tree(spine: StateSpine) -> TaskTreeResponse:
    """AC-3: every `blocked_by` id with no matching task in the spine gets
    its own flagged "missing dependency" stub node, rather than being
    silently dropped from the tree.
    """
    known_ids = {task.id for task in spine.tasks}
    nodes = [
        TaskTreeNode(id=task.id, status=task.status, blocked_by=task.blocked_by, missing=False)
        for task in spine.tasks
    ]
    missing_ids = {
        dep for task in spine.tasks for dep in task.blocked_by if dep not in known_ids
    }
    nodes += [
        TaskTreeNode(id=missing_id, status="missing", blocked_by=[], missing=True)
        for missing_id in sorted(missing_ids)
    ]
    return TaskTreeResponse(project_iri=spine.project_iri, nodes=nodes)
