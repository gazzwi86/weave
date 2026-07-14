"""Law 13: response schema for `GET /api/role-home` (PLAT-V1-TASK-017)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from weave_backend.schemas.dashboard import WidgetOut


class RoleHomeCapability(BaseModel):
    id: str
    label: str
    href: str | None = None
    available: bool
    coming_soon: str | None = None


class RoleHomeNextAction(BaseModel):
    label: str
    href: str


class CompletenessRow(BaseModel):
    kind: str
    instance_count: int
    coverage_gap_count: int


class RoleHomeResponse(BaseModel):
    capabilities: list[RoleHomeCapability]
    summary: dict[str, Any]
    next_action: RoleHomeNextAction
    completeness: list[CompletenessRow]
    tiles: list[WidgetOut]
