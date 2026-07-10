"""AC-1..AC-8: `POST /api/projects/{id}/sdk-generations` +
`GET /api/projects/{id}/sdk-generations/latest` (BE-V1-TASK-005, BE-SDK-1
delivery, E8-S5/FR-059).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException  # noqa: F401

from weave_backend.db.pool import tenant_connection  # noqa: F401
from weave_backend.generation.sdk_store import get_latest_sdk_run  # noqa: F401
from weave_backend.generation.sdk_trigger import (  # noqa: F401
    ProjectHasNoPinnedVersion,
    SdkGenerationInFlight,
    run_sdk_generation,
    trigger_sdk_generation,
)
from weave_backend.projects.model import get_project  # noqa: F401
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.sdk_generation import (
    SdkBreakingHold,  # noqa: F401
    SdkGenerationStatusResponse,
    SdkGenerationTriggerResponse,
)

router = APIRouter(prefix="/api/projects", tags=["sdk-generation"])


@router.post(
    "/{project_iri}/sdk-generations",
    response_model=SdkGenerationTriggerResponse,
    status_code=202,
)
async def trigger_sdk_generation_route(
    project_iri: str,
    background_tasks: BackgroundTasks,
    principal: Annotated[object, Depends(require_project_role(ProjectAction.GENERATE))],
    authorization: Annotated[str | None, Header()] = None,
) -> SdkGenerationTriggerResponse:
    raise NotImplementedError


@router.get(
    "/{project_iri}/sdk-generations/latest",
    response_model=SdkGenerationStatusResponse,
)
async def get_latest_sdk_generation_route(
    project_iri: str,
    principal: Annotated[object, Depends(require_project_role(ProjectAction.GENERATE))],
) -> SdkGenerationStatusResponse:
    raise NotImplementedError
