"""AC-5 (TASK-014, build-engine EPIC-002): `.../contributors` thin CRUD over
`pm/contributors.py`. Mutations (`PUT`/`DELETE`) go through
`Depends(require_project_role(ProjectAction.CONTRIBUTORS))` -- admin-only
(`rbac.PROJECT_ROLE_ACTIONS`). The list read carries no guard, same as
every other PM read (tenant membership is sufficient).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.pm.contributors import Contributor, NewContributor, delete, get_all, upsert
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.contributors import (
    ContributorListResponse,
    ContributorResponse,
    UpsertContributorRequest,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_response(contributor: Contributor) -> ContributorResponse:
    return ContributorResponse(
        principal_iri=contributor.principal_iri,
        role=contributor.role,
        added_by=contributor.added_by,
        added_at=contributor.added_at,
    )


@router.get("/{project_iri}/contributors", response_model=ContributorListResponse)
async def list_contributors_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ContributorListResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        contributors = await get_all(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    return ContributorListResponse(items=[_to_response(c) for c in contributors])


@router.put("/{project_iri}/contributors/{principal_iri}", response_model=ContributorResponse)
async def upsert_contributor_route(
    project_iri: str,
    principal_iri: str,
    body: UpsertContributorRequest,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.CONTRIBUTORS))],
) -> ContributorResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        contributor = await upsert(
            conn,
            tenant_id=principal.tenant_id,
            contributor=NewContributor(
                project_iri=project_iri,
                principal_iri=principal_iri,
                role=body.role,
                added_by=principal.principal_iri,
            ),
        )
    return _to_response(contributor)


@router.delete("/{project_iri}/contributors/{principal_iri}", status_code=204)
async def delete_contributor_route(
    project_iri: str,
    principal_iri: str,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.CONTRIBUTORS))],
) -> None:
    async with tenant_connection(principal.tenant_id) as conn:
        await delete(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            principal_iri=principal_iri,
        )
