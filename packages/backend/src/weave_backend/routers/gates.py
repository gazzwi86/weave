"""AC-1..AC-7: `POST /api/tasks/{task_id}/gates/dor`,
`POST /api/tasks/{task_id}/gates/dod`,
`POST /api/projects/{project_iri}/gates/pre-scaffold`
(BE-TASK-007, build-engine EPIC-012).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.store import get_task_brief
from weave_backend.build.gates import run_dod_gate, run_dor_gate, run_pre_scaffold_gate
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.gates import DodGateResponse, DorGateResponse, PreScaffoldGateResponse

router = APIRouter(tags=["gates"])


@router.post(
    "/api/tasks/{task_id}/gates/dor",
    response_model=DorGateResponse,
    response_model_exclude_none=True,
)
async def run_dor_gate_route(
    task_id: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> DorGateResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        stored = await get_task_brief(conn, tenant_id=principal.tenant_id, task_id=task_id)
        if stored is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        result = await run_dor_gate(
            conn,
            tenant_id=principal.tenant_id,
            actor_iri=principal.principal_iri,
            task_id=task_id,
            content=stored.content,
        )
    return DorGateResponse.model_validate(result)


@router.post("/api/tasks/{task_id}/gates/dod", response_model=DodGateResponse)
async def run_dod_gate_route(
    task_id: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> DodGateResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        result = await run_dod_gate(
            conn, tenant_id=principal.tenant_id, actor_iri=principal.principal_iri, task_id=task_id
        )
    return DodGateResponse.model_validate(result)


@router.post(
    "/api/projects/{project_iri}/gates/pre-scaffold", response_model=PreScaffoldGateResponse
)
async def run_pre_scaffold_gate_route(
    project_iri: str, principal: Annotated[Principal, Depends(get_current_principal)]
) -> PreScaffoldGateResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        result = await run_pre_scaffold_gate(
            conn,
            tenant_id=principal.tenant_id,
            actor_iri=principal.principal_iri,
            project_iri=project_iri,
        )
    return PreScaffoldGateResponse.model_validate(result)
