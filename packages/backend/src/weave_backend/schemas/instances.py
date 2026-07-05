"""Law 13: request/response schemas for `/api/instances` (CE-TASK-005,
E2-S1/-S2/-S4). Mutations dispatch through the shared CE-WRITE-1
`ApplyRequest`/`ApplyResponse` (`schemas/operations.py`) -- these schemas
only describe the guided-form-specific shape around that shared pipeline
(the create request body, the duplicate/violation/delete-confirm
responses, and the browse listing), never a copy of the shared ones.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AddInstanceRequest(BaseModel):
    kind: str = Field(min_length=1)
    label: str = Field(min_length=1)
    properties: dict[str, Any] = Field(default_factory=dict)


class UpdateInstanceRequest(BaseModel):
    #: AC-005-06: at least one field must actually change -- an empty
    #: partial-update is a 422 at the schema boundary, not a silent no-op.
    properties: dict[str, Any] = Field(min_length=1)


class InstanceMutationResponse(BaseModel):
    iri: str
    version_iri: str
    activity_iri: str


class InstanceViolation(BaseModel):
    field: str
    path: str
    severity: str
    message: str


class InstanceViolationsResponse(BaseModel):
    violations: list[InstanceViolation]


class DeleteConfirmEdge(BaseModel):
    predicate: str
    other: str


class DeleteConfirmResponse(BaseModel):
    #: AC-005-07/-10: the caller must resend the DELETE with `?confirm=true`
    #: after reviewing this preview -- nothing has been mutated yet.
    requires_confirmation: bool = True
    outgoing: list[DeleteConfirmEdge]
    incoming: list[DeleteConfirmEdge]
    #: AC-005-10: true if `iri` is visible in the latest *published* version
    #: -- deleting it would affect already-published data, not just the draft.
    published: bool


class InstanceSummary(BaseModel):
    iri: str
    kind: str
    label: str


class BrowseInstancesResponse(BaseModel):
    results: list[InstanceSummary]
    #: AC-005-13: the offset to pass as `?cursor=` for the next page, or
    #: `None` once exhausted.
    next_page: int | None = None
