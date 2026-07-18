"""G9/G10 (docs/design/remediation-2-api-gaps.md): response DTO for
`GET /api/projects/{project_iri}/epics`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class EpicTaskCounts(BaseModel):
    total: int
    done: int
    in_progress: int
    blocked: int


class EpicRollupEntry(BaseModel):
    epic_id: str
    #: `None` only when a synthesized/unassigned bucket has no title and no
    #: brief supplied one either -- in practice the "unassigned" bucket
    #: always carries a title (see `epics.UNASSIGNED_EPIC_TITLE`).
    title: str | None
    ordinal: int
    #: G10: derived purely from task-status lanes, no timestamp capture --
    #: `started_at`/`completed_at` are deliberately absent (deferred, see
    #: docs/design/remediation-2-api-gaps.md G10).
    status: Literal["done", "active", "upcoming"]
    task_counts: EpicTaskCounts


class EpicRollupResponse(BaseModel):
    project_iri: str
    epics: list[EpicRollupEntry]
