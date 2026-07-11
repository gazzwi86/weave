"""Law 13: response schemas for `GET /api/projects/{id}/tasks/{task_id}`
and its `/audit` proxy (BE-V1-TASK-018, build-engine EPIC-005). Read-only
routes, no request body -- path params are validated inline by FastAPI.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ConsoleSourceResponse(BaseModel):
    live_channel: str | None
    log_location_ref: str | None


class TaskDetailResponse(BaseModel):
    brief: dict[str, Any] | None
    handoff: list[dict[str, Any]]
    console: ConsoleSourceResponse
    captures_manifest_ref: str | None


class TaskAuditEntryResponse(BaseModel):
    seq: int
    ts: str
    actor_principal_iri: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None


class TaskAuditResponse(BaseModel):
    entries: list[TaskAuditEntryResponse]
