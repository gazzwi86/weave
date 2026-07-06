"""AC-1/AC-7: `POST /api/projects/{project_iri}/runs`, `GET /api/state/{project_iri}`
request/response bodies (BE-TASK-006, build-engine EPIC-011).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class StartRunRequest(BaseModel):
    run_mode: Literal["draft_spec_only", "spec_to_build", "spike"]
    turn_cap_override: int | None = None


class StartRunResponse(BaseModel):
    run_id: str
    project_iri: str
    status: str
    turn_cap: int


class TaskStateResponse(BaseModel):
    id: str
    status: str
    blocked_by: list[str]
    codify_checkpoint: dict[str, Any] | None


class StateSpineResponse(BaseModel):
    project_iri: str
    phase: str
    dispatch_count: int
    tasks: list[TaskStateResponse]
