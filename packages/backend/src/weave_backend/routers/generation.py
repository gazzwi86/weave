"""AC-1..AC-8: `POST /api/projects/{project_iri}/tasks/{task_id}/generate`
(BE-TASK-008, build-engine EPIC-008).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.briefs.ce_read_client import CeReadUnavailable, get_ce_read_client
from weave_backend.db.pool import tenant_connection
from weave_backend.generation.gates import GateFailure
from weave_backend.generation.service import (
    BriefNotFoundError,
    GenerationContext,
    ProjectNotFoundError,
    generate_app,
)
from weave_backend.schemas.generation import GenerateResponse

router = APIRouter(prefix="/api/projects", tags=["generation"])


@router.post(
    "/{project_iri}/tasks/{task_id}/generate",
    response_model=GenerateResponse,
    status_code=201,
)
async def generate_app_route(
    project_iri: str,
    task_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[AsyncClient, Depends(get_ce_read_client)],
) -> GenerateResponse:
    ctx = GenerationContext(
        tenant_id=principal.tenant_id,
        project_iri=project_iri,
        task_id=task_id,
        ce_client=ce_client,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            outcome = await generate_app(conn, ctx)
        except ProjectNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except BriefNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"error": "brief_not_found"}) from exc
        except CeReadUnavailable as exc:
            raise HTTPException(
                status_code=503, detail={"error": "ce_read_unavailable"}
            ) from exc
        except GateFailure as exc:
            raise HTTPException(
                status_code=422, detail={"error": exc.error, **exc.evidence}
            ) from exc

    return GenerateResponse.model_validate(outcome)
