"""Law 13: request/response schemas for `.../bindings` CRUD (TASK-022,
build-engine EPIC-002, FR-010).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class BindRequest(BaseModel):
    system: Literal["confluence", "jira", "servicenow"]
    connector_ref: str
    space_ref: str


class HealthResponse(BaseModel):
    """AC-3: read-through, never stored -- `unavailable` on any read failure,
    never a fake `ok`.
    """

    # Not a Literal: "ok"/"degraded"/"error" vocabulary is the connector's,
    # not Build's -- only "unavailable" is Build-invented (AC-3, read
    # failure), so this stays open rather than rejecting an unrecognised
    # connector-side status.
    status: str
    last_sync: str | None = None
    last_error: str | None = None
    error_count: int = 0
    skipped_count: int = 0


class BindingResponse(BaseModel):
    binding_id: str
    system: str
    connector_ref: str
    space_ref: str
    created_by: str
    created_at: datetime
    health: HealthResponse


class BindingListResponse(BaseModel):
    items: list[BindingResponse]
