"""Request-body schema for CE-WRITE-1 (`POST /api/operations/apply`).

`Op` is a discriminated union on the `op` field, matching the contract's
`add_node | update_node | add_edge | delete_node | delete_edge` set. New
nodes carry a local `ref`, resolved to real IRIs as edges in the same batch
are applied.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class AddNodeOp(BaseModel):
    op: Literal["add_node"]
    ref: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    label: str = Field(min_length=1)
    properties: dict[str, Any] = Field(default_factory=dict)


class UpdateNodeOp(BaseModel):
    op: Literal["update_node"]
    iri: str = Field(min_length=1)
    properties: dict[str, Any] = Field(default_factory=dict)


class AddEdgeOp(BaseModel):
    op: Literal["add_edge"]
    subject_ref: str = Field(min_length=1)
    predicate: str = Field(min_length=1)
    object_ref: str = Field(min_length=1)


class DeleteNodeOp(BaseModel):
    op: Literal["delete_node"]
    iri: str = Field(min_length=1)


class DeleteEdgeOp(BaseModel):
    op: Literal["delete_edge"]
    subject: str = Field(min_length=1)
    predicate: str = Field(min_length=1)
    object: str = Field(min_length=1)


Op = Annotated[
    AddNodeOp | UpdateNodeOp | AddEdgeOp | DeleteNodeOp | DeleteEdgeOp,
    Field(discriminator="op"),
]


class ApplyRequest(BaseModel):
    operations: list[Op] = Field(min_length=1)
    #: Service-principal IRI attributed in PROV-O/audit. Never trusted for
    #: authorization -- the authenticated `Principal` (JWT) is what RBAC
    #: checks, this field is attribution only.
    actor: str = Field(min_length=1)
    target: str = "draft"
    idempotency_key: str | None = None
    #: XT-002: a Build Engine "spike" run may never write back to a
    #: protected branch/graph -- see ADR-003. Any other value is a no-op.
    run_mode: str = "normal"


class ViolationDetail(BaseModel):
    focus_node: str
    path: str | None
    severity: str
    message: str


class ApplyResponse(BaseModel):
    activity_iri: str
    applied_count: int
    version_iri: str
    advisories: list[ViolationDetail] = Field(default_factory=list)


class ViolationsResponse(BaseModel):
    violations: list[ViolationDetail]
