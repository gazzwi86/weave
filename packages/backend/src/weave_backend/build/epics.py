"""G9/G10 (docs/design/remediation-2-api-gaps.md): epic rollup for
`GET /api/projects/{project_iri}/epics`.

There is no epic entity anywhere in the M1 data model -- `state_spine`'s
`TaskState` and `briefs.schema.TaskBrief` both carry no epic field. Rather
than a migration, this reuses the additive-JSONB-field precedent
(`TaskBrief.adr_refs`): each brief may optionally carry `epic_id`/
`epic_title`, and the rollup groups `state_spine` tasks by that value.
A task whose brief has no `epic_id` (or has no brief at all) lands in a
flagged "unassigned" bucket rather than being dropped -- same "flag, don't
drop" spirit as `build.board.build_task_tree`'s missing-dependency stub.

`status`/`task_counts` reuse `build.board.lane_for_status` so this rollup
can never drift from what the board itself shows for the same task.
No task-transition timestamps exist in M1, so `started_at`/`completed_at`
are omitted entirely (G10's documented fallback) -- ordinal + status only.
"""

from __future__ import annotations

from dataclasses import dataclass

from weave_backend.build.board import lane_for_status
from weave_backend.build.state_spine import StateSpine
from weave_backend.schemas.epics import EpicRollupEntry, EpicRollupResponse, EpicTaskCounts

UNASSIGNED_EPIC_ID = "unassigned"
UNASSIGNED_EPIC_TITLE = "Unassigned tasks"


@dataclass(frozen=True)
class EpicRef:
    """A brief's optional epic association (briefs.schema.TaskBrief's
    `epic_id`/`epic_title` fields), keyed by `task_id` by the caller.
    """

    epic_id: str | None = None
    epic_title: str | None = None


@dataclass
class _EpicAccumulator:
    epic_id: str
    title: str | None
    total: int = 0
    done: int = 0
    blocked: int = 0
    #: Lane "Backlog" count -- used only to derive `status`, never exposed
    #: on the response (task_counts's 4 fields are the brief's exact ask).
    queued: int = 0


def _epic_key(ref: EpicRef | None) -> tuple[str, str | None]:
    if ref is not None and ref.epic_id:
        return ref.epic_id, ref.epic_title
    return UNASSIGNED_EPIC_ID, UNASSIGNED_EPIC_TITLE


def _bucket_tasks(
    spine: StateSpine, epic_refs: dict[str, EpicRef]
) -> dict[str, _EpicAccumulator]:
    groups: dict[str, _EpicAccumulator] = {}
    for task in spine.tasks:
        epic_id, title = _epic_key(epic_refs.get(task.id))
        group = groups.setdefault(epic_id, _EpicAccumulator(epic_id=epic_id, title=title))
        group.title = group.title or title
        group.total += 1
        lane = lane_for_status(task.status)
        if lane == "Done":
            group.done += 1
        elif lane == "Review":
            group.blocked += 1
        elif lane == "Backlog":
            group.queued += 1
    return groups


def _epic_status(group: _EpicAccumulator) -> str:
    if group.done == group.total:
        return "done"
    if group.queued == group.total:
        return "upcoming"
    return "active"


def _to_entry(group: _EpicAccumulator, ordinal: int) -> EpicRollupEntry:
    return EpicRollupEntry(
        epic_id=group.epic_id,
        title=group.title,
        ordinal=ordinal,
        status=_epic_status(group),  # type: ignore[arg-type]
        task_counts=EpicTaskCounts(
            total=group.total,
            done=group.done,
            in_progress=group.total - group.done - group.blocked,
            blocked=group.blocked,
        ),
    )


def build_epic_rollup(spine: StateSpine, epic_refs: dict[str, EpicRef]) -> EpicRollupResponse:
    groups = _bucket_tasks(spine, epic_refs)
    ordered = sorted(groups.values(), key=lambda g: (g.epic_id == UNASSIGNED_EPIC_ID, g.epic_id))
    entries = [_to_entry(group, ordinal) for ordinal, group in enumerate(ordered)]
    return EpicRollupResponse(project_iri=spine.project_iri, epics=entries)
