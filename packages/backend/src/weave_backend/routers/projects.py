"""AC-1..AC-6: `POST /api/projects`, `GET /api/projects/{project_iri}`
(BE-TASK-001, build-engine EPIC-002).
"""

from __future__ import annotations

from typing import Annotated, cast

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

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
from weave_backend.repo_bootstrap.store import ProjectRepoRow, fetch_project_repo_row
from weave_backend.schemas.projects import (
    CreateProjectRequest,
    CreateProjectResponse,
    ProjectResponse,
    RepoInfo,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project_exists_response(existing_iri: str) -> HTTPException:
    return HTTPException(
        status_code=409, detail={"error": "project_exists", "existing_iri": existing_iri}
    )


async def projects_validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Normalises `/api/projects`' 422 body to AC-6's `{"error":
    "validation_error", "field": <name>}` shape. Without this, a request
    that fails Pydantic validation before the route body runs (e.g. `name`
    over `max_length`) gets FastAPI's default `{"detail": [...]}` list --
    a different shape than this router's own hand-raised 422s. Scoped to
    this router's path prefix only; every other endpoint keeps the default.

    `exc` is typed `Exception` (not `RequestValidationError`) to match
    Starlette's `add_exception_handler` signature exactly -- it is always
    a `RequestValidationError` in practice, since that's the only type this
    handler is registered for (see `weave_backend/__init__.py`).
    """
    validation_exc = cast("RequestValidationError", exc)
    if not request.url.path.startswith(router.prefix):
        return await request_validation_exception_handler(request, validation_exc)
    errors = validation_exc.errors()
    field = str(errors[0]["loc"][-1]) if errors else "unknown"
    # Wrapped under "detail" to match the body shape of every HTTPException
    # this router raises directly (Starlette always nests HTTPException's
    # `detail` under that key) -- so a client sees one consistent envelope.
    detail = {"error": "validation_error", "field": field}
    return JSONResponse(status_code=422, content={"detail": detail})


@router.post("", status_code=201, response_model=CreateProjectResponse)
async def create_project_route(
    body: CreateProjectRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[httpx.AsyncClient, Depends(get_ce_client)],
    authorization: Annotated[str | None, Header()] = None,
) -> CreateProjectResponse:
    slug = slugify(body.name)
    if not body.name.strip() or not slug:
        # A name that is non-empty/non-whitespace can still slugify to ""
        # (e.g. emoji/punctuation-only) -- same AC-6 422, caught before any
        # DB touch so it never reaches the `projects` table's CHECK(slug <> '').
        raise HTTPException(status_code=422, detail={"error": "validation_error", "field": "name"})

    async with tenant_connection(principal.tenant_id) as conn:
        existing_iri = await find_existing_project_iri(
            conn, tenant_id=principal.tenant_id, slug=slug
        )
        if existing_iri is not None:
            raise _project_exists_response(existing_iri)

        try:
            headers = {"Authorization": authorization} if authorization else None
            pinned_version = await get_pinned_latest_version(ce_client, headers=headers)
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


def _repo_info(repo_row: ProjectRepoRow) -> RepoInfo | None:
    if repo_row.repo_provider and repo_row.repo_url and repo_row.repo_default_branch:
        return RepoInfo(
            provider=repo_row.repo_provider,
            repo_url=repo_row.repo_url,
            default_branch=repo_row.repo_default_branch,
        )
    return None


@router.get("/{project_iri}", response_model=ProjectResponse)
async def get_project_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ProjectResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        project = await get_project(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if project is None:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        repo_row = await fetch_project_repo_row(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    return ProjectResponse(
        project_iri=project.project_iri,
        name=project.name,
        pinned_graph_version_iri=project.pinned_graph_version_iri,
        created_at=project.created_at,
        repo=_repo_info(repo_row) if repo_row is not None else None,
    )
