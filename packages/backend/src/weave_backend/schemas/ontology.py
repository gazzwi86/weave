"""Law 13: request/response schemas for CE-VERSION-1 / CE-DIFF-1
(`routers/ontology.py`).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class VersionEntry(BaseModel):
    version_iri: str
    semver: str
    status: str
    created_at: datetime
    published_at: datetime | None
    actor_iri: str


class VersionsResponse(BaseModel):
    versions: list[VersionEntry]
    total: int
    page: int
    per_page: int


class PublishResponse(BaseModel):
    version_iri: str
    status: str
    published_at: datetime | None


class TripleModel(BaseModel):
    subject: str
    predicate: str
    object: str


class ModificationModel(BaseModel):
    subject: str
    predicate: str
    before: str
    after: str


class DiffResponse(BaseModel):
    """ADR-002: a unified triple-set shape, not `contracts.md` CE-DIFF-1's
    literal `Node|Edge`/`{ref,kind,before,after}` -- see the ADR for why the
    simplification is in scope for this task.
    """

    added: list[TripleModel]
    removed: list[TripleModel]
    modified: list[ModificationModel]


class VersionsQueryParams(BaseModel):
    workspace_id: str | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
