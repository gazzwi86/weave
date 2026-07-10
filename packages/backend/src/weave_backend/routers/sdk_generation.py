"""AC-1..AC-8: `POST /api/projects/{id}/sdk-generations` +
`GET /api/projects/{id}/sdk-generations/latest` (BE-V1-TASK-005, BE-SDK-1
delivery, E8-S5/FR-059).
"""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException

from weave_backend.auth.dependencies import Principal
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.sdk_store import get_latest_sdk_run
from weave_backend.generation.sdk_trigger import (
    ProjectHasNoPinnedVersion,
    SdkGenerationInFlight,
    run_sdk_generation,
    trigger_sdk_generation,
)
from weave_backend.projects.model import get_project
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.sdk_generation import (
    SdkBreakingHold,
    SdkGenerationStatus,
    SdkGenerationStatusResponse,
    SdkGenerationTriggerResponse,
)

router = APIRouter(prefix="/api/projects", tags=["sdk-generation"])
_NOT_FOUND = HTTPException(status_code=404, detail={"error": "not_found"})


@router.post(
    "/{project_iri}/sdk-generations",
    response_model=SdkGenerationTriggerResponse,
    status_code=202,
)
async def trigger_sdk_generation_route(
    project_iri: str,
    background_tasks: BackgroundTasks,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.GENERATE))],
    authorization: Annotated[str | None, Header()] = None,
) -> SdkGenerationTriggerResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if project is None:
            raise _NOT_FOUND
        try:
            run = await trigger_sdk_generation(conn, project=project, tenant_id=principal.tenant_id)
        except ProjectHasNoPinnedVersion as exc:
            raise HTTPException(status_code=422, detail={"error": "no_pinned_version"}) from exc
        except SdkGenerationInFlight as exc:
            raise HTTPException(status_code=409, detail={"error": "generation_in_flight"}) from exc

    background_tasks.add_task(
        run_sdk_generation,
        tenant_id=principal.tenant_id,
        run_id=run.run_id,
        project_iri=project_iri,
    )
    return SdkGenerationTriggerResponse(
        generation_id=run.run_id, status=cast("SdkGenerationStatus", run.status)
    )


@router.get(
    "/{project_iri}/sdk-generations/latest",
    response_model=SdkGenerationStatusResponse,
)
async def get_latest_sdk_generation_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.GENERATE))],
) -> SdkGenerationStatusResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if project is None:
            raise _NOT_FOUND
        run = await get_latest_sdk_run(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if run is None:
        raise _NOT_FOUND

    breaking_hold = run.payload.get("breaking_hold")
    return SdkGenerationStatusResponse(
        generation_id=run.run_id,
        status=cast("SdkGenerationStatus", run.status),
        package_version=run.payload.get("package_version"),
        breaking_hold=SdkBreakingHold(**breaking_hold) if breaking_hold else None,
        failure_cause=run.payload.get("failure_cause"),
    )
