"""Request/response DTOs for `/api/projects/{project_iri}/briefs`
(BE-TASK-002, FR-018). Kept separate from `briefs/schema.py`'s `TaskBrief`
document contract -- this is the wire-level API shape, not the persisted
document.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CreateBriefRequest(BaseModel):
    task_description: str = Field(min_length=1)
    dep_summaries: list[str] = Field(default_factory=list)


class CreateBriefResponse(BaseModel):
    task_id: str
    brief_iri: str
    stored_at: str


class GetBriefResponse(BaseModel):
    task_id: str
    brief_iri: str
    schema_version: str
    content: dict[str, Any]
