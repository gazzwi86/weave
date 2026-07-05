"""Law 13: request/response schemas for `POST`/`GET /api/requests` (BE-TASK-003,
build-engine EPIC-001, Request Studio).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

#: AC-6's exact allowed set, in the order the 422 body must list them.
ALLOWED_RUN_MODES = ("draft_spec_only", "spec_to_build", "spike")


class CreateRequestBody(BaseModel):
    """Both fields default to `""` (not required) so a missing field reaches
    this router's own hand-raised 422 (AC-6's exact `{"error":
    "validation_error", "field": ...}` shape) instead of FastAPI's generic
    missing-field validation-error shape -- same technique as
    `schemas/projects.py`'s `CreateProjectRequest.name`.
    """

    prompt: str = Field(default="")
    run_mode: str = Field(default="")
    description: str | None = None


class CreateRequestResponse(BaseModel):
    request_id: str
    status: str
    stream_url: str


class RequestStatusResponse(BaseModel):
    request_id: str
    status: str
    run_mode: str
    graph_context: str
    draft_content: dict[str, Any] | None
    created_at: datetime
