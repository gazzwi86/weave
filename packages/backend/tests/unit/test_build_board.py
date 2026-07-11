"""AC-1/AC-2/AC-3 (BE-V1-TASK-017, build-engine EPIC-004): six-lane
board-lane mapping, retry-chip data, and task-tree missing-dependency
flagging over the M1 state spine.
"""

from __future__ import annotations

import pytest

from weave_backend.build import store
from weave_backend.build.board import (
    LANE_OF_STATUS,
    LANE_ORDER,
    build_board,
    build_task_tree,
    lane_for_status,
)
from weave_backend.build.state_spine import StateSpine, TaskState


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    store.reset_for_tests()


def _spine(tasks: list[TaskState], *, tenant_id: str = "t1") -> StateSpine:
    return StateSpine(
        project_iri="urn:weave:project:p1",
        tenant_id=tenant_id,
        run_id="r1",
        turn_cap=60,
        tasks=tasks,
    )


def test_lane_for_status_maps_every_known_status_and_defaults_unknown_to_backlog() -> None:
    # AC-1's six-lane mapping must be a total, greppable constants table --
    # every known TaskState.status resolves, and an unrecognised status
    # falls back to "Backlog" rather than being dropped (AC-3's "flag, don't
    # drop" spirit applied to the lane mapping itself).
    assert lane_for_status("Queued") == "Backlog"
    assert lane_for_status("Ready") == "Ready"
    assert lane_for_status("Blocked") == "Review"
    assert lane_for_status("revision") == "QA"
    assert lane_for_status("Done") == "Done"
    assert lane_for_status("some-future-status") == "Backlog"
    assert set(LANE_OF_STATUS.values()) <= set(LANE_ORDER)


def test_should_render_six_lanes_within_budget() -> None:
    # AC-1: the board response always carries all six lanes (including the
    # structurally-empty "In Progress" lane in M1), regardless of which
    # statuses are actually present.
    spine = _spine([TaskState(id="task-1", status="Queued")])
    board = build_board(spine)
    assert board.lanes == list(LANE_ORDER)
    assert len(board.lanes) == 6
    assert board.cards[0].lane == "Backlog"


def test_should_show_failure_class_and_retry_ceiling_on_card() -> None:
    # AC-2: a failed task's retry chip carries its E6-S3 failure class and
    # per-class ceiling ("syntax 2/3" style), sourced from the ephemeral
    # task store (ADR); a ceiling-hit task (status == "Blocked") is flagged
    # hitl_escalated, never silently shown as still running.
    store.create_task("t1", "task-1")
    store.increment_retry("t1", "task-1", "syntax")
    store.increment_retry("t1", "task-1", "syntax")

    spine = _spine([TaskState(id="task-1", status="Blocked")])
    board = build_board(spine)

    card = board.cards[0]
    assert card.failure_class == "syntax"
    assert card.retry_attempt == 2
    assert card.retry_ceiling == 2
    assert card.hitl_escalated is True


def test_should_flag_missing_blocked_by_predecessor_instead_of_dropping_node() -> None:
    # AC-3: a `blocked_by` id with no matching task in the spine is rendered
    # as its own flagged "missing dependency" node, not silently omitted.
    spine = _spine(
        [TaskState(id="task-2", status="Ready", blocked_by=["task-1-does-not-exist"])]
    )
    tree = build_task_tree(spine)

    ids = {node.id: node for node in tree.nodes}
    assert "task-2" in ids
    assert ids["task-2"].missing is False
    assert "task-1-does-not-exist" in ids
    assert ids["task-1-does-not-exist"].missing is True
