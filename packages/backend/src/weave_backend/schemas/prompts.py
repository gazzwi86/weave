"""BE-V1-TASK-021 (FR-065): `POST /api/projects/{project_iri}/prompts`
request/response bodies.
"""

from __future__ import annotations

from pydantic import BaseModel


class CreatePromptRequest(BaseModel):
    prompt_text: str


class CreatePromptResponse(BaseModel):
    run_id: str
    prompt_id: str
