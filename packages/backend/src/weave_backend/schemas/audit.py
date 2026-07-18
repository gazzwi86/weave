"""Law 13: request/response schemas for the PLAT-AUDIT-1 routes."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AuditEntryResponse(BaseModel):
    seq: int
    ts: str
    actor_principal_iri: str
    engine: str
    event_type: str
    target_iri: str
    diff_summary: dict[str, Any] | None
    hash: str
    prev_hash: str
    signature: str


class AuditEntriesResponse(BaseModel):
    entries: list[AuditEntryResponse]
    total: int
    page: int
    per_page: int


class VerifyChainResponse(BaseModel):
    valid: bool
    entries_checked: int = 0
    first_broken_seq: int | None = None
    error: str | None = None


class ActorCountResponse(BaseModel):
    principal_iri: str
    event_count: int


class TargetCountResponse(BaseModel):
    target_iri: str
    count: int


class ComplianceResponse(BaseModel):
    chain_status: str
    entries_checked: int
    first_broken_seq: int | None
    by_event_category: dict[str, int]
    top_actors: list[ActorCountResponse]
    top_targets: list[TargetCountResponse]
    period: str
    shacl_validated: int
    shacl_rejections: int
    audit_outages: int


class BrandConformanceResponse(BaseModel):
    window_days: int
    passed: int
    failed: int
    critical_failures: int
    conformance_pct: float


class AuditQueryParams(BaseModel):
    """Validates the `GET /api/audit` query string (Law 13 -- never cast raw
    query params). `tenant_id` must equal the caller's own tenant; the route
    layer rejects a mismatch rather than trusting it.
    """

    tenant_id: str = Field(min_length=1)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
    engine: str | None = None
    event_type: str | None = None
    actor_principal_iri: str | None = None
    target_iri: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    q: str | None = None


class AuditCountsQueryParams(BaseModel):
    """G6: validates `GET /api/audit/counts` -- same filter dimensions as
    `AuditQueryParams` minus pagination (a grouped-count response has no
    page/per_page)."""

    tenant_id: str = Field(min_length=1)
    engine: str | None = None
    event_type: str | None = None
    actor_principal_iri: str | None = None
    target_iri: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    q: str | None = None


class EventTypeCountResponse(BaseModel):
    event_type: str
    count: int


class EventTypeCountsResponse(BaseModel):
    counts: list[EventTypeCountResponse]
