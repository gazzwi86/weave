"""Law 13: request/response schemas for `.../settings` (TASK-014,
build-engine EPIC-002, AC-2/AC-3/AC-4/AC-6). AC-6: no secret fields exist
on this shape -- there is nothing to leak.
"""

from __future__ import annotations

from pydantic import BaseModel


class ProjectSettingsResponse(BaseModel):
    model_tier: str
    model_tier_source: str
    cost_cap_usd: float | None
    cost_cap_source: str | None


class UpdateProjectSettingsRequest(BaseModel):
    model_tier: str | None = None
    cost_cap_usd: float | None = None
