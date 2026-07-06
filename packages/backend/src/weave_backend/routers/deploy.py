"""BE-TASK-009 (build-engine EPIC-008/EPIC-009): `POST
/api/projects/{project_iri}/tasks/{task_id}/deploy` and `GET
/api/projects/{project_iri}/demo`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.deploy.ce_write_client import CeWriteUnavailable, get_ce_write_client
from weave_backend.deploy.service import (
    DeployContext,
    GenerationRunNotFoundError,
    ProjectNotFoundError,
    publish_and_write_back,
)
from weave_backend.projects.model import get_project
from weave_backend.schemas.deploy import DemoResponse, DeployRequestBody
from weave_backend.schemas.requests import ALLOWED_RUN_MODES

router = APIRouter(prefix="/api/projects", tags=["deploy"])


def _validate_run_mode(body: DeployRequestBody) -> None:
    if body.run_mode not in ALLOWED_RUN_MODES:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_run_mode", "allowed": list(ALLOWED_RUN_MODES)},
        )


def _status_code_for(outcome: dict[str, object]) -> int:
    if outcome.get("publish_status") == "failed" or outcome.get("write_back_status") == "rejected":
        return 200
    return 201


@router.post("/{project_iri}/tasks/{task_id}/deploy")
async def deploy_route(
    project_iri: str,
    task_id: str,
    body: DeployRequestBody,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_write_client: Annotated[AsyncClient, Depends(get_ce_write_client)],
) -> JSONResponse:
    _validate_run_mode(body)
    ctx = DeployContext(
        tenant_id=principal.tenant_id,
        project_iri=project_iri,
        task_id=task_id,
        commit_sha=body.commit_sha,
        run_mode=body.run_mode,
        ce_write_client=ce_write_client,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            outcome = await publish_and_write_back(conn, ctx)
        except ProjectNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except GenerationRunNotFoundError as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except CeWriteUnavailable as exc:
            raise HTTPException(
                status_code=503, detail={"error": "ce_write_unavailable"}
            ) from exc

    return JSONResponse(status_code=_status_code_for(outcome), content=outcome)


@router.get("/{project_iri}/demo", response_model=DemoResponse)
async def get_demo_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> DemoResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return DemoResponse(
        output_location_ref=project.demo_output_location_ref,
        write_back_complete=project.write_back_complete,
        write_back_artefact_iri=project.write_back_artefact_iri,
    )
