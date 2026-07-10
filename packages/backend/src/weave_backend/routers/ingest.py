"""CE-V1-TASK-012: the ingest spine -- `POST /api/ingest/artefacts`, job/
proposal reads, and accept/reject. Accept is the only mutation path; it
dispatches through CE-WRITE-1's `_run_apply` (ADR-006 reuse), never writes
the graph itself (AC-001-08).
"""

from __future__ import annotations

import os
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.ingest.corpus import corpus_bucket, corpus_key, hash_content
from weave_backend.ingest.jobs import summarize_proposal_statuses
from weave_backend.ingest.store import (
    NewJob,
    NewProposal,  # noqa: F401 -- re-exported for worker/test convenience, not used directly here
    get_job,
    get_proposal,
    insert_job,
    list_proposals_for_job,
    proposal_statuses_for_job,
    update_proposal_status,
)
from weave_backend.ingest.uploads import UploadRejected, validate_upload
from weave_backend.ingest.worker import run_ingest_job
from weave_backend.operations.ingest_provenance import mint_artefact_iri, write_artefact_entity
from weave_backend.operations.pipeline import ProvExtra
from weave_backend.routers.operations import _run_apply
from weave_backend.schemas.ingest import (
    AcceptProposalResponse,
    JobStatusResponse,
    JobSummaryResponse,
    ProposalResponse,
    ProposalsListResponse,
    RejectProposalResponse,
    UploadArtefactResponse,
)
from weave_backend.schemas.operations import ApplyRequest, ApplyResponse, ViolationsResponse
from weave_backend.storage.tenant_objects import s3_client
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

#: AC-001-10 / DoR decision (HITL 2026-07-08): 25 MB, tunable later.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

#: Brief pseudocode: `kind=detect(ext)`. Only `NoOpExtractor` exists this
#: task (DEFAULT_REGISTRY is empty) -- an unmapped ext still ingests, just
#: yields zero proposals, so this map only needs to be a stable label.
_EXT_KIND = {"pdf": "doc", "docx": "doc", "png": "image", "jpg": "image", "jpeg": "image"}


def _kind_for_ext(ext: str) -> str:
    return _EXT_KIND.get(ext.lower(), "unknown")


def _context_fields(
    source_system: str | None, owner: str | None, date_of_truth: str | None,
    sensitivity: str | None, context: str | None,
) -> dict[str, str]:
    raw = {
        "source_system": source_system, "owner": owner, "date_of_truth": date_of_truth,
        "sensitivity": sensitivity, "context": context,
    }
    return {k: v for k, v in raw.items() if v}


@router.post("/artefacts", status_code=201, response_model=UploadArtefactResponse)
async def upload_artefact_route(  # noqa: PLR0913 -- Law E waiver: FR-044's 5 optional
    # context fields are independent multipart form fields, not a JSON body
    # a BaseModel could group -- see .claude/state/complexity-waivers.md.
    background_tasks: BackgroundTasks,
    principal: Annotated[Principal, Depends(get_current_principal)],
    file: Annotated[UploadFile, File()],
    source_system: Annotated[str | None, Form()] = None,
    owner: Annotated[str | None, Form()] = None,
    date_of_truth: Annotated[str | None, Form()] = None,
    sensitivity: Annotated[str | None, Form()] = None,
    context: Annotated[str | None, Form()] = None,
) -> UploadArtefactResponse:
    content = await file.read()
    try:
        validate_upload(content, max_upload_bytes=MAX_UPLOAD_BYTES)
    except UploadRejected as exc:
        raise HTTPException(
            status_code=422, detail={"error": "upload_rejected", "message": str(exc)}
        ) from exc

    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    ext = (file.filename or "").rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    artefact_hash = hash_content(content)
    key = corpus_key(tenant_id=principal.tenant_id, artefact_hash=artefact_hash, ext=ext)
    s3_client().put_object(
        Bucket=corpus_bucket(os.environ.get("WEAVE_ENV", "dev")),
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )

    artefact_iri = mint_artefact_iri(f"{principal.tenant_id}-{artefact_hash}")
    context_fields = _context_fields(source_system, owner, date_of_truth, sensitivity, context)

    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

        await write_artefact_entity(
            workspace.named_graph_iri,
            artefact_iri=artefact_iri,
            original_filename=file.filename or key,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
        )
        job_id = await insert_job(
            conn,
            NewJob(
                tenant_id=principal.tenant_id, workspace_id=workspace_id, artefact_iri=artefact_iri,
                kind=_kind_for_ext(ext), context=context_fields,
            ),
        )

    background_tasks.add_task(run_ingest_job, job_id, tenant_id=principal.tenant_id)
    return UploadArtefactResponse(artefact_iri=artefact_iri, job_id=job_id)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_route(
    job_id: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> JobStatusResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        job = await get_job(conn, tenant_id=principal.tenant_id, job_id=job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"error": "job_not_found"})
        statuses = await proposal_statuses_for_job(
            conn, tenant_id=principal.tenant_id, job_id=job_id
        )

    summary = summarize_proposal_statuses(statuses)
    return JobStatusResponse(
        job_id=job.id, status=job.status, kind=job.kind, artefact_iri=job.artefact_iri,
        error=job.error,
        summary=JobSummaryResponse(
            committed=summary.committed, rejected=summary.rejected, skipped=summary.skipped
        ),
    )


@router.get("/jobs/{job_id}/proposals", response_model=ProposalsListResponse)
async def list_proposals_route(
    job_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    limit: Annotated[int | None, Query(ge=1, le=500)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProposalsListResponse:
    """AC-001-04: no query params -> every proposal (never silently
    truncated); an explicit `limit` returns a page plus `has_more` so a
    caller can detect + page past it.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        job = await get_job(conn, tenant_id=principal.tenant_id, job_id=job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"error": "job_not_found"})
        fetch_limit = limit + 1 if limit is not None else None
        rows = await list_proposals_for_job(
            conn, tenant_id=principal.tenant_id, job_id=job_id, limit=fetch_limit, offset=offset
        )

    has_more = limit is not None and len(rows) > limit
    if limit is not None:
        rows = rows[:limit]

    return ProposalsListResponse(
        proposals=[
            ProposalResponse(
                id=row.id, ops=row.ops, confidence=row.confidence, matched_iri=row.matched_iri,
                reason=row.reason, status=row.status,
            )
            for row in rows
        ],
        has_more=has_more,
    )


async def _accept_via_ce_write_1(
    conn: Any, *, principal: Principal, proposal: Any, job: Any
) -> ApplyResponse | ViolationsResponse | HTTPException:
    """AC-001-05: one activity, two prov moments -- reuses the job's ingest
    `activity_iri` (never mints a second) and attributes the extractor agent
    + source artefact via `prov:used`.
    """
    if job.activity_iri is None or job.extractor_iri is None:
        return HTTPException(status_code=409, detail={"error": "job_not_ready"})

    body = ApplyRequest.model_validate(
        {"operations": proposal.ops, "actor": principal.principal_iri, "target": "draft"}
    )
    prov_extra = ProvExtra(
        activity_iri=job.activity_iri,
        artefact_iri=job.artefact_iri,
        extractor_iri=job.extractor_iri,
    )
    return await _run_apply(
        conn, principal=principal, workspace_id=job.workspace_id, body=body, prov_extra=prov_extra
    )


@router.post("/proposals/{proposal_id}/accept", response_model=AcceptProposalResponse)
async def accept_proposal_route(
    proposal_id: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> AcceptProposalResponse | JSONResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        proposal = await get_proposal(conn, tenant_id=principal.tenant_id, proposal_id=proposal_id)
        if proposal is None:
            raise HTTPException(status_code=404, detail={"error": "proposal_not_found"})
        job = await get_job(conn, tenant_id=principal.tenant_id, job_id=proposal.job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"error": "job_not_found"})

        outcome = await _accept_via_ce_write_1(
            conn, principal=principal, proposal=proposal, job=job
        )

        if isinstance(outcome, ApplyResponse):
            await update_proposal_status(
                conn, tenant_id=principal.tenant_id, proposal_id=proposal_id, status="accepted"
            )

    if isinstance(outcome, HTTPException):
        raise outcome
    if isinstance(outcome, ViolationsResponse):
        return JSONResponse(status_code=422, content=outcome.model_dump())
    return AcceptProposalResponse(
        activity_iri=outcome.activity_iri, version_iri=outcome.version_iri
    )


@router.post("/proposals/{proposal_id}/reject", response_model=RejectProposalResponse)
async def reject_proposal_route(
    proposal_id: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> RejectProposalResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        proposal = await get_proposal(conn, tenant_id=principal.tenant_id, proposal_id=proposal_id)
        if proposal is None:
            raise HTTPException(status_code=404, detail={"error": "proposal_not_found"})
        await update_proposal_status(
            conn, tenant_id=principal.tenant_id, proposal_id=proposal_id, status="rejected"
        )

    return RejectProposalResponse(id=proposal_id, status="rejected")
