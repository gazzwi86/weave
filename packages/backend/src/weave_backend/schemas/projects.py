"""Law 13: request/response schemas for `POST`/`GET /api/projects`
(BE-TASK-001, build-engine EPIC-002).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SourceControlConfig(BaseModel):
    """M1 producer for TASK-010 (repo bootstrap): config only -- the token
    *value* lives in AWS Secrets Manager, referenced here by
    `token_secret_ref`, never persisted or logged directly.
    """

    provider: Literal["github", "gitlab"]
    token_secret_ref: str = Field(min_length=1)


class CreateProjectRequest(BaseModel):
    # Default "" (not a required field) so an absent `name` reaches the
    # route's own empty/whitespace check -- AC-6's exact `{"error":
    # "validation_error", "field": "name"}` body -- instead of FastAPI's
    # generic missing-field validation-error shape.
    name: str = Field(default="", max_length=120)
    description: str | None = None
    source_control: SourceControlConfig | None = None


class CreateProjectResponse(BaseModel):
    project_iri: str
    pinned_graph_version_iri: str
    created_at: datetime
    # AC-7: derived, never stored (B10) -- direct create always starts here.
    lifecycle_phase: Literal["Speccing"] = "Speccing"


class RepoInfo(BaseModel):
    """TASK-010's bootstrapped repo handle, echoed on `GET /api/projects/{id}`
    once `ensure_project_repo` has run.
    """

    provider: str
    repo_url: str
    default_branch: str


class StalenessInfo(BaseModel):
    """TASK-009/FR-036: pin lag vs CE-VERSION-1's latest. `stale` is
    `"unknown"` (never a fabricated `false`) when CE was unreachable.
    """

    lag: int | None
    stale: bool | Literal["unknown"]


class ProjectResponse(BaseModel):
    project_iri: str
    name: str
    pinned_graph_version_iri: str
    created_at: datetime
    repo: RepoInfo | None = None
    staleness: StalenessInfo


class ProjectCardResponse(BaseModel):
    """AC-1: one row on the grid. `lifecycle_phase`/`owner_iri` are derived
    at read time (ADR-014), never stored.
    """

    project_iri: str
    name: str
    created_at: datetime
    lifecycle_phase: Literal["Speccing", "Building", "Live monitoring", "Archived"]
    owner_iri: str | None


class ProjectGridResponse(BaseModel):
    items: list[ProjectCardResponse]
    next_cursor: str | None
