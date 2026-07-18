"""G11 (docs/design/remediation-2-api-gaps.md): response DTO for
`GET /api/projects/{project_iri}/spec-artifacts`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

#: Only `"task-brief"` is API-served today -- PRD/roadmap/tech-spec are
#: doc-served (`docs/specs/weave/engines/<entity>.md` sections and
#: sibling files), not persisted rows this endpoint can index. G11 closes
#: the task-brief half of the gap; the doc-served half stays a known
#: deferral (see PR body), not a fabricated entry here.
SpecArtifactType = Literal["task-brief"]
SpecArtifactStatus = Literal["drafted", "pending_review", "approved"]


class SpecArtifactEntry(BaseModel):
    type: SpecArtifactType
    id: str
    status: SpecArtifactStatus
    #: G10-style deferral: no task-transition timestamp exists in M1, so
    #: this never populates yet.
    approved_at: datetime | None = None
    ref: str


class SpecArtifactIndexResponse(BaseModel):
    project_iri: str
    artifacts: list[SpecArtifactEntry]
