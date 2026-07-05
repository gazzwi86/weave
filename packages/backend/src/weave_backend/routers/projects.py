"""AC-1..AC-6: `POST /api/projects`, `GET /api/projects/{project_iri}`
(BE-TASK-001, build-engine EPIC-002).
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.ce_version_client import (
    CeVersionUnavailable,
    get_ce_client,
    get_pinned_latest_version,
)
from weave_backend.projects.model import (
    NewProject,
    ProjectExists,
    create_project,
    find_existing_project_iri,
    get_project,
    slugify,
)
from weave_backend.schemas.projects import (
    CreateProjectRequest,
    CreateProjectResponse,
    ProjectResponse,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_exists_response(existing_iri: str) -> HTTPException:
    return HTTPException(
        status_code=409, detail={"error": "project_exists", "existing_iri": existing_iri}
    )


@router.post("", status_code=201, response_model=CreateProjectResponse)
async def create_project_route(
    body: CreateProjectRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
) -> CreateProjectResponse:
    if not body.name.strip():
        raise HTTPException(status_code=422, detail={"error": "validation_error", "field": "name"})

    slug = slugify(body.name)
    async with tenant_connection(principal.tenant_id) as conn:
        existing_iri = await find_existing_project_iri(
            conn, tenant_id=principal.tenant_id, slug=slug
        )
        if existing_iri is not None:
            raise _project_exists_response(existing_iri)

        try:
            pinned_version = await get_pinned_latest_version(ce_client)
        except CeVersionUnavailable as exc:
            raise HTTPException(
                status_code=503, detail={"error": "ce_version_unavailable"}
            ) from exc

        source_control = body.source_control
        fields = NewProject(
            tenant_id=principal.tenant_id,
            slug=slug,
            name=body.name,
            description=body.description,
            pinned_graph_version_iri=pinned_version,
            source_control_provider=source_control.provider if source_control else None,
            source_control_token_secret_ref=(
                source_control.token_secret_ref if source_control else None
            ),
        )
        try:
            project = await create_project(conn, fields)
        except ProjectExists as exc:
            raise _project_exists_response(exc.existing_iri) from exc

    return CreateProjectResponse(
        project_iri=project.project_iri,
        pinned_graph_version_iri=project.pinned_graph_version_iri,
        created_at=project.created_at,
    )


@router.get("/{project_iri}", response_model=ProjectResponse)
async def get_project_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ProjectResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if project is None:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return ProjectResponse(
        project_iri=project.project_iri,
        name=project.name,
        pinned_graph_version_iri=project.pinned_graph_version_iri,
        created_at=project.created_at,
    )
