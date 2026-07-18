"""G9/G10 (docs/design/remediation-2-api-gaps.md): epic rollup derived
purely from `state_spine` task status + each brief's optional
`epic_id`/`epic_title` -- there is no epic entity anywhere in the DB, so
this is entirely a derivation over already-loaded data (no I/O), same
posture as `build/board.py`'s `build_board`.
"""

from __future__ import annotations

from weave_backend.build.epics import EpicRef, build_epic_rollup
from weave_backend.build.state_spine import StateSpine, TaskState


def _spine(tasks: list[TaskState], *, tenant_id: str = "t1") -> StateSpine:
    return StateSpine(
        project_iri="urn:weave:project:p1",
        tenant_id=tenant_id,
        run_id="r1",
        turn_cap=60,
        tasks=tasks,
    )


def test_groups_tasks_by_brief_epic_id_and_counts_lanes() -> None:
    spine = _spine(
        [
            TaskState(id="task-1", status="Done"),
            TaskState(id="task-2", status="Ready"),
            TaskState(id="task-3", status="Blocked"),
        ]
    )
    refs = {
        "task-1": EpicRef(epic_id="EPIC-001", epic_title="Board"),
        "task-2": EpicRef(epic_id="EPIC-001", epic_title="Board"),
        "task-3": EpicRef(epic_id="EPIC-002", epic_title="Gates"),
    }
    rollup = build_epic_rollup(spine, refs)
    by_id = {e.epic_id: e for e in rollup.epics}

    assert by_id["EPIC-001"].title == "Board"
    assert by_id["EPIC-001"].task_counts.total == 2
    assert by_id["EPIC-001"].task_counts.done == 1
    assert by_id["EPIC-001"].task_counts.in_progress == 1
    assert by_id["EPIC-001"].task_counts.blocked == 0
    assert by_id["EPIC-002"].task_counts.blocked == 1


def test_tasks_without_brief_epic_id_land_in_flagged_unassigned_bucket() -> None:
    # "Flag, don't drop" -- same spirit as build_task_tree's missing-dependency
    # stub node: a task with no brief-supplied epic_id is never silently
    # omitted from the rollup.
    spine = _spine([TaskState(id="task-1", status="Ready")])
    rollup = build_epic_rollup(spine, {})

    assert len(rollup.epics) == 1
    assert rollup.epics[0].epic_id == "unassigned"
    assert rollup.epics[0].title == "Unassigned tasks"
    assert rollup.epics[0].task_counts.total == 1


def test_ordinal_sorts_epics_alphabetically_and_puts_unassigned_last() -> None:
    spine = _spine(
        [
            TaskState(id="task-1", status="Ready"),
            TaskState(id="task-2", status="Ready"),
            TaskState(id="task-3", status="Ready"),
        ]
    )
    refs = {"task-1": EpicRef(epic_id="EPIC-002"), "task-2": EpicRef(epic_id="EPIC-001")}
    rollup = build_epic_rollup(spine, refs)

    ordinals = [(e.epic_id, e.ordinal) for e in rollup.epics]
    assert ordinals == [("EPIC-001", 0), ("EPIC-002", 1), ("unassigned", 2)]


def test_status_done_when_all_tasks_in_epic_are_done() -> None:
    spine = _spine([TaskState(id="task-1", status="Done"), TaskState(id="task-2", status="Done")])
    refs = {"task-1": EpicRef(epic_id="EPIC-001"), "task-2": EpicRef(epic_id="EPIC-001")}
    rollup = build_epic_rollup(spine, refs)

    assert rollup.epics[0].status == "done"


def test_status_upcoming_when_all_tasks_in_epic_are_still_queued() -> None:
    spine = _spine([TaskState(id="task-1", status="Queued")])
    refs = {"task-1": EpicRef(epic_id="EPIC-001")}
    rollup = build_epic_rollup(spine, refs)

    assert rollup.epics[0].status == "upcoming"


def test_status_active_when_epic_has_started_but_not_finished() -> None:
    spine = _spine([TaskState(id="task-1", status="Ready")])
    refs = {"task-1": EpicRef(epic_id="EPIC-001")}
    rollup = build_epic_rollup(spine, refs)

    assert rollup.epics[0].status == "active"


def test_no_started_or_completed_timestamp_fields_on_entry() -> None:
    # G10: no task-transition timestamps exist in the M1 state spine --
    # ordinal + status only, dates deliberately deferred (documented in
    # docs/design/remediation-2-api-gaps.md).
    spine = _spine([TaskState(id="task-1", status="Ready")])
    rollup = build_epic_rollup(spine, {})

    dumped = rollup.epics[0].model_dump()
    assert "started_at" not in dumped
    assert "completed_at" not in dumped
