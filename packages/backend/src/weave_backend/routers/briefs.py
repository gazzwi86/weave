"""AC-1..AC-6: `POST /api/projects/{project_iri}/briefs`,
`GET /api/projects/{project_iri}/briefs/{task_id}` (BE-TASK-002,
build-engine EPIC-005).
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.architect import ModelRoutingMiss, draft_brief_document
from weave_backend.briefs.ce_read_client import (
    CeReadUnavailable,
    get_bpmo_context,
    get_ce_read_client,
)
from weave_backend.briefs.schema import TaskBrief
from weave_backend.briefs.store import (
    NewBrief,
    build_brief_iri,
    generate_task_id,
    get_task_brief,
    insert_task_brief,
)
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.briefs import CreateBriefRequest, CreateBriefResponse, GetBriefResponse

router = APIRouter(prefix="/api/projects", tags=["briefs"])


def _brief_invalid_response(exc: ValidationError) -> HTTPException:
    missing_fields = sorted({str(err["loc"][-1]) for err in exc.errors()})
    return HTTPException(
        status_code=422, detail={"error": "brief_invalid", "missing_fields": missing_fields}
    )


@router.post("/{project_iri}/briefs", status_code=201, response_model=CreateBriefResponse)
async def create_brief_route(
    project_iri: str,
    body: CreateBriefRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_read_client)],
) -> CreateBriefResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            bpmo_context = await get_bpmo_context(ce_client, project_iri)
        except CeReadUnavailable as exc:
            raise HTTPException(status_code=503, detail={"error": "ce_read_unavailable"}) from exc

        try:
            raw_brief = draft_brief_document(
                body.task_description, bpmo_context, body.dep_summaries
            )
        except ModelRoutingMiss as exc:
            raise HTTPException(
                status_code=500, detail={"error": "model_routing_miss"}
            ) from exc

        task_id = generate_task_id(project_iri, body.task_description)
        brief_iri = build_brief_iri(task_id)
        raw_brief["task_id"] = task_id
        raw_brief["project_iri"] = project_iri
        try:
            brief = TaskBrief.model_validate(raw_brief)
        except ValidationError as exc:
            raise _brief_invalid_response(exc) from exc

        created_at = await insert_task_brief(
            conn,
            NewBrief(
                tenant_id=principal.tenant_id,
                task_id=task_id,
                project_iri=project_iri,
                brief_iri=brief_iri,
                schema_version=brief.schema_version,
                content=brief.model_dump(mode="json"),
            ),
        )
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="brief_generated",
                actor_iri=principal.principal_iri,
                subject_iri=brief_iri,
                payload={"task_id": task_id},
                engine="build",
            ),
        )

    return CreateBriefResponse(
        task_id=task_id, brief_iri=brief_iri, stored_at=created_at.isoformat()
    )


@router.get("/{project_iri}/briefs/{task_id}", response_model=GetBriefResponse)
async def get_brief_route(
    project_iri: str,  # kept for RESTful nesting; lookup below is by task_id alone
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> GetBriefResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        stored = await get_task_brief(conn, tenant_id=principal.tenant_id, task_id=task_id)
    if stored is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return GetBriefResponse(
        task_id=stored.task_id,
        brief_iri=stored.brief_iri,
        schema_version=stored.schema_version,
        content=stored.content,
    )
