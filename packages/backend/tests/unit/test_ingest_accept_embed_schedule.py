"""CE-V1-TASK-014 AC-003-02/-08: accept route schedules embed-on-commit as a
background task (Law F: never blocks the accept response on Bedrock/S3).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import BackgroundTasks

from weave_backend.corpus.commit import embed_artefact_on_commit
from weave_backend.ingest.store import JobRow
from weave_backend.routers.ingest import _schedule_embed_on_commit


def _job(corpus_key: str | None) -> JobRow:
    now = datetime.now(UTC)
    return JobRow(
        id="job-1",
        tenant_id="tenant-a",
        workspace_id="ws-1",
        artefact_iri="urn:weave:instances:artefact-1",
        kind="document",
        status="accepted",
        context={},
        activity_iri="urn:weave:instances:activity-1",
        extractor_iri="urn:weave:instances:extractor-1",
        error=None,
        created_at=now,
        updated_at=now,
        corpus_key=corpus_key,
    )


def test_schedules_embed_on_commit_when_job_has_a_corpus_key() -> None:
    background_tasks = BackgroundTasks()

    _schedule_embed_on_commit(
        background_tasks, tenant_id="tenant-a", job=_job("tenant-a/hash1/original.md")
    )

    assert len(background_tasks.tasks) == 1
    task = background_tasks.tasks[0]
    assert task.func is embed_artefact_on_commit
    assert task.kwargs == {
        "tenant_id": "tenant-a",
        "artefact_iri": "urn:weave:instances:artefact-1",
        "corpus_key": "tenant-a/hash1/original.md",
    }


def test_does_not_schedule_when_job_has_no_corpus_key() -> None:
    background_tasks = BackgroundTasks()

    _schedule_embed_on_commit(background_tasks, tenant_id="tenant-a", job=_job(None))

    assert not background_tasks.tasks
