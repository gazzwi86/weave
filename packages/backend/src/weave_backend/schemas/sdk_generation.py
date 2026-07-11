"""Law 13: response DTOs for `POST /api/projects/{id}/sdk-generations` and
`GET /api/projects/{id}/sdk-generations/latest` (BE-V1-TASK-005). Error
bodies stay plain dicts on `HTTPException.detail` -- same convention as
`schemas/generation.py` -- so only the success shapes are modelled.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

SdkGenerationStatus = Literal["queued", "running", "breaking_hold", "passed", "failed"]


class SdkGenerationTriggerResponse(BaseModel):
    generation_id: str
    status: SdkGenerationStatus


class SdkBreakingHold(BaseModel):
    version_iris: list[str]


class SdkGenerationStatusResponse(BaseModel):
    generation_id: str
    status: SdkGenerationStatus
    package_version: str | None = None
    breaking_hold: SdkBreakingHold | None = None
    failure_cause: str | None = None
