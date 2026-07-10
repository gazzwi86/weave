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


class ProposalsListResponse(BaseModel):
    proposals: list[ProposalResponse]


class AcceptProposalResponse(BaseModel):
    activity_iri: str
    version_iri: str


class RejectProposalResponse(BaseModel):
    id: str
    status: str
