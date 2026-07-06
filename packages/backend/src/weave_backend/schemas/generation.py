"""Law 13: response DTO for `POST
/api/projects/{project_iri}/tasks/{task_id}/generate` (BE-TASK-008,
build-engine EPIC-008). Gate-failure (422) bodies stay plain dicts on
`HTTPException.detail` -- same convention as every other router in this
codebase (see `routers/tasks.py`) -- so only the success shape is modelled.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class GatePassed(BaseModel):
    gate: Literal["secret_scan", "sast", "type_check", "package_existence", "mutation"]
    status: Literal["PASS"]
    score: float | None = None


class GenerateResponse(BaseModel):
    commit_sha: str
    branch: str
    gates_passed: list[GatePassed]
