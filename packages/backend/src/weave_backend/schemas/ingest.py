"""Law 13: response schemas for the ingest spine (CE-V1-TASK-012).

The upload request is multipart (file + optional FR-044 context form
fields), not a JSON body -- no `BaseModel` for it; the route validates the
individual fields directly.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class UploadArtefactResponse(BaseModel):
    artefact_iri: str
    job_id: str


class JobSummaryResponse(BaseModel):
    committed: int
    rejected: int
    skipped: int


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    kind: str
    artefact_iri: str
    error: str | None = None
    summary: JobSummaryResponse | None = None


class ProposalResponse(BaseModel):
    id: str
    ops: list[dict[str, Any]]
    confidence: float
    matched_iri: str | None
    reason: str
    status: str
    #: TASK-013: locator (e.g. page/heading-path) for the source text this
    #: candidate was extracted from -- `None` for non-document extractors.
    source_span: str | None = None
    #: TASK-013 AC-002-04: `confidence < resolved threshold` (PLAT-SETTINGS-1
    #: `ingest.confidence_flag_threshold`, default 0.6) -- computed server-side
    #: so the frontend never hardcodes the threshold or pre-selects a flagged
    #: proposal for accept.
    low_confidence: bool = False


class ProposalsListResponse(BaseModel):
    proposals: list[ProposalResponse]
    #: AC-001-04: true only when an explicit `limit` truncated this page --
    #: the no-param default returns everything, so `has_more` is False then.
    has_more: bool = False


class AcceptProposalResponse(BaseModel):
    activity_iri: str
    version_iri: str


class RejectProposalResponse(BaseModel):
    id: str
    status: str
