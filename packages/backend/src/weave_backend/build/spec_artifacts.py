"""G11 (docs/design/remediation-2-api-gaps.md): spec-artifact index for
`GET /api/projects/{project_iri}/spec-artifacts`.

Only per-task briefs are a real, API-served row source today -- there is
no persisted PRD/roadmap/tech-spec entity (those are doc-served sections
under `docs/specs/weave/engines/<entity>.md`, per `CLAUDE.md`'s spec
artifact table). This builds one `task-brief` entry per stored brief;
`status` is derived from the same state-spine task status the board and
epic rollup already read, so it can never drift from what those views
show for the same task. No task-transition timestamps exist in M1
(G10's documented fallback, reused here), so `approved_at` stays unset.
"""

from __future__ import annotations

from weave_backend.briefs.store import BriefRef
from weave_backend.build.state_spine import StateSpine
from weave_backend.schemas.spec_artifacts import (
    SpecArtifactEntry,
    SpecArtifactIndexResponse,
    SpecArtifactStatus,
)


def _status_for_task(spine: StateSpine, task_id: str) -> SpecArtifactStatus:
    task = next((t for t in spine.tasks if t.id == task_id), None)
    if task is None:
        return "drafted"
    if task.status == "Done":
        return "approved"
    if task.status == "Blocked":
        return "pending_review"
    return "drafted"


def _to_entry(spine: StateSpine, brief: BriefRef) -> SpecArtifactEntry:
    return SpecArtifactEntry(
        type="task-brief",
        id=brief.brief_iri,
        status=_status_for_task(spine, brief.task_id),
        ref=f"/api/projects/{spine.project_iri}/briefs/{brief.task_id}",
    )


def build_spec_artifact_index(
    spine: StateSpine, briefs: list[BriefRef]
) -> SpecArtifactIndexResponse:
    return SpecArtifactIndexResponse(
        project_iri=spine.project_iri,
        artifacts=[_to_entry(spine, brief) for brief in briefs],
    )
