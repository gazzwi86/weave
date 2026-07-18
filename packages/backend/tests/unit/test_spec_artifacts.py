"""G11 (docs/design/remediation-2-api-gaps.md): spec-artifact index
derivation -- one entry per stored brief, `status` derived from the brief's
state-spine task status (no fabricated review workflow, no timestamp
capture -- `approved_at` stays unset, same posture as G10's epic rollup).
"""

from __future__ import annotations

from weave_backend.briefs.store import BriefRef
from weave_backend.build.spec_artifacts import build_spec_artifact_index
from weave_backend.build.state_spine import StateSpine, TaskState

_PROJECT_IRI = "urn:weave:project:t1:acme"


def _spine(tasks: list[TaskState]) -> StateSpine:
    return StateSpine(
        project_iri=_PROJECT_IRI, tenant_id="t1", run_id="r1", turn_cap=60, tasks=tasks
    )


def test_brief_with_done_task_is_approved() -> None:
    spine = _spine([TaskState(id="t1", status="Done")])
    briefs = [BriefRef(task_id="t1", brief_iri="urn:weave:brief:t1")]

    index = build_spec_artifact_index(spine, briefs)

    entry = index.artifacts[0]
    assert entry.type == "task-brief"
    assert entry.id == "urn:weave:brief:t1"
    assert entry.status == "approved"
    assert entry.ref == f"/api/projects/{_PROJECT_IRI}/briefs/t1"


def test_brief_with_blocked_task_is_pending_review() -> None:
    spine = _spine([TaskState(id="t1", status="Blocked")])
    briefs = [BriefRef(task_id="t1", brief_iri="urn:weave:brief:t1")]

    index = build_spec_artifact_index(spine, briefs)

    assert index.artifacts[0].status == "pending_review"


def test_brief_with_no_matching_spine_task_is_drafted() -> None:
    spine = _spine([])
    briefs = [BriefRef(task_id="t1", brief_iri="urn:weave:brief:t1")]

    index = build_spec_artifact_index(spine, briefs)

    assert index.artifacts[0].status == "drafted"


def test_brief_with_other_task_status_is_drafted() -> None:
    spine = _spine([TaskState(id="t1", status="Ready")])
    briefs = [BriefRef(task_id="t1", brief_iri="urn:weave:brief:t1")]

    index = build_spec_artifact_index(spine, briefs)

    assert index.artifacts[0].status == "drafted"


def test_approved_at_never_set() -> None:
    """G10-style deferral: no task-transition timestamp exists in M1."""
    spine = _spine([TaskState(id="t1", status="Done")])
    briefs = [BriefRef(task_id="t1", brief_iri="urn:weave:brief:t1")]

    index = build_spec_artifact_index(spine, briefs)

    assert index.artifacts[0].approved_at is None


def test_no_briefs_returns_empty_artifact_list() -> None:
    spine = _spine([TaskState(id="t1", status="Done")])

    index = build_spec_artifact_index(spine, [])

    assert index.artifacts == []
    assert index.project_iri == _PROJECT_IRI
