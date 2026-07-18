"""AC-1..AC-7: `POST /api/tasks/{task_id}/gates/dor`,
`POST /api/tasks/{task_id}/gates/dod`,
`POST /api/projects/{project_iri}/gates/pre-scaffold`
(BE-TASK-007, build-engine EPIC-012).

G12 (docs/design/remediation-2-api-gaps.md) adds the read-only
`GET /api/projects/{project_iri}/gates?status=pending` list alongside
these gate-execution routes -- same `tags=["gates"]` router, one file per
Law D's "one PR per gap family" grouping since both are gate concerns.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.store import get_task_brief
from weave_backend.build.gates import run_dod_gate, run_dor_gate, run_pre_scaffold_gate
from weave_backend.build.pending_gates import build_pending_gates
from weave_backend.build.state_spine import StateSpine, load_state_spine
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.model import get_project
from weave_backend.schemas.gates import (
    DodGateResponse,
    DorGateResponse,
    PendingGatesResponse,
    PreScaffoldGateResponse,
)

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


async def _load_spine_or_404(project_iri: str, principal: Principal) -> StateSpine:
    """Same "empty, not 404" split as `routers/board.py`'s BUG-06 fix --
    a project with no run yet has no `state_spines` row, which is a valid
    empty pending-gate list, not a missing project.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        spine = await load_state_spine(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
        if spine is not None:
            return spine
        project = await get_project(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return StateSpine(project_iri=project_iri, tenant_id=principal.tenant_id, run_id="", turn_cap=0)


@router.get("/api/projects/{project_iri}/gates", response_model=PendingGatesResponse)
async def get_pending_gates_route(
    project_iri: str,
    status: Annotated[Literal["pending"], Query()],
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> PendingGatesResponse:
    spine = await _load_spine_or_404(project_iri, principal)
    return build_pending_gates(spine)
