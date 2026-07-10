"""Law 13: request/response schemas for `.../contributors` CRUD
(TASK-014, build-engine EPIC-002, AC-5).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class UpsertContributorRequest(BaseModel):
    role: Literal["admin", "editor"]


class ContributorResponse(BaseModel):
    principal_iri: str
    role: str
    added_by: str
    added_at: datetime


class ContributorListResponse(BaseModel):
    items: list[ContributorResponse]
