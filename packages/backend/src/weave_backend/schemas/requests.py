"""Law 13: request/response schemas for `POST`/`GET /api/requests` (BE-TASK-003,
build-engine EPIC-001, Request Studio).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

#: AC-6's exact allowed set, in the order the 422 body must list them.
ALLOWED_RUN_MODES = ("draft_spec_only", "spec_to_build", "spike")

#: BE-TASK-004 AC's exact allowed set for `POST .../sign-off`'s `action`.
ALLOWED_SIGN_OFF_ACTIONS = ("approve", "reject")


class CreateRequestBody(BaseModel):
    """Both fields default to `""` (not required) so a missing field reaches
    this router's own hand-raised 422 (AC-6's exact `{"error":
    "validation_error", "field": ...}` shape) instead of FastAPI's generic
    missing-field validation-error shape -- same technique as
    `schemas/projects.py`'s `CreateProjectRequest.name`.
    """

    prompt: str = Field(default="")
    run_mode: str = Field(default="")
    description: str | None = None
    #: TASK-024 AC-1/AC-4: human-facing request name, required 1-200 chars.
    name: str = Field(default="")
    #: TASK-024 AC-2/AC-6: grounding-entity IRIs, resolved via CE-READ-1.
    grounding_entity_iris: list[str] = Field(default_factory=list)
    #: TASK-024 AC-5: required (kebab-case) unless run_mode == draft_spec_only.
    target_repo_name: str | None = None


class CreateRequestResponse(BaseModel):
    request_id: str
    status: str
    stream_url: str


class RequestStatusResponse(BaseModel):
    request_id: str
    status: str
    run_mode: str
    graph_context: str
    draft_content: dict[str, Any] | None
    created_at: datetime
    #: TASK-024 AC-7: visible request record fields.
    name: str = ""
    grounding_entity_iris: list[str] = Field(default_factory=list)
    target_repo_name: str | None = None


class TypeaheadEntity(BaseModel):
    """One `GET /api/ontology/entities/typeahead` result (AC-2)."""

    iri: str
    label: str
    kind: str


class TypeaheadResponse(BaseModel):
    results: list[TypeaheadEntity]


#: TASK-024 AC-5: kebab-case, 3-100 chars, mirrors project-slug shape.
TARGET_REPO_NAME_PATTERN = r"^[a-z0-9-]{3,100}$"

#: TASK-024 AC-4: name required, 1-200 chars.
NAME_MAX_LENGTH = 200


class BlastRadiusResponse(BaseModel):
    """AC-1/AC-2: `status` is `"computed"` (domains/services/entity_count
    populated) or `"unavailable"` (message populated instead).
    """

    status: str
    domains: list[str] | None = None
    services: list[str] | None = None
    entity_count: int | None = None
    message: str | None = None


class CostEstimateResponse(BaseModel):
    """AC-3."""

    estimate_usd: float
    cap_usd: float
    cap_level: str
    exceeds_cap: bool


class SignOffBody(BaseModel):
    """Default `""` (not required) so a missing/invalid `action` reaches
    the route's own 422 (`{"error": "validation_error", "field": "action"}`)
    instead of FastAPI's generic missing-field shape -- same technique as
    `CreateRequestBody.run_mode`.
    """

    action: str = Field(default="")
    rejection_reason: str | None = None
    blast_radius_acknowledged: bool = False


class SignOffResponse(BaseModel):
    """AC-5/AC-6: exactly one of `project_iri` / `rejection_reason` /
    `remaining` is populated, matching `status`.
    """

    status: str
    project_iri: str | None = None
    rejection_reason: str | None = None
    remaining: list[str] | None = None
