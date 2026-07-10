"""Law 13: request/response schemas for `PUT/GET /api/standards/*`
(TASK-001, build-engine EPIC-002).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PutStandardRequest(BaseModel):
    project_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    body_md: str = Field(min_length=1)
    stack_pins: dict[str, str] | None = None
    policy_iri: str = Field(min_length=1)
    status: str | None = None


class StandardResponse(BaseModel):
    standard_id: str
    scope: str
    project_id: str | None
    standard_key: str
    title: str
    body_md: str
    stack_pins: dict[str, str] | None
    policy_iri: str
    status: str
    created_at: datetime
    updated_at: datetime


class StandardsListResponse(BaseModel):
    standards: list[StandardResponse]
