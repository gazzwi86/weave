"""TASK-023 (E2-S6, FR-061/B9, build-engine EPIC-002): `.../source-control`
thin CRUD (GET/PUT only -- no DELETE, no "test connection", per the brief's
GAPS section). GET carries no guard (any tenant member may read the
provider + reference), same as every other PM read. PUT goes through
`Depends(require_project_role(ProjectAction.SETTINGS))` -- admin-only.

AC-1 (write-only token, never echoed): `put_scm_token` writes straight to
Secrets Manager; only the reference (`token_secret_ref`) is ever persisted
to `projects` or returned in any response shape. AC-5: an unconfigured
project reads as 404 -- the frontend's normal setup state (`SetupCard`),
not an error banner.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.pm.source_control import (
    CONFIGURED_EVENT_TYPE,
    get_configured_meta,
    get_row,
    project_exists,
    set_row,
)
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.repo_bootstrap.secrets import build_scm_secret_ref, put_scm_token
from weave_backend.schemas.source_control import SourceControlPutRequest, SourceControlResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/{project_iri}/source-control", response_model=SourceControlResponse)
async def get_source_control_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SourceControlResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        config = await get_row(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        if config is None:  # AC-5: unconfigured (or no such project) -- same 404 either way
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        meta = await get_configured_meta(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    return SourceControlResponse(
        provider=config.provider,  # type: ignore[arg-type]
        token_secret_ref=config.token_secret_ref,
        configured_by=meta.configured_by if meta else "",
        configured_at=meta.configured_at if meta else "",
    )


@router.put("/{project_iri}/source-control", response_model=SourceControlResponse)
async def put_source_control_route(
    project_iri: str,
    body: SourceControlPutRequest,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.SETTINGS))],
) -> SourceControlResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        exists = await project_exists(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    if not exists:
        # Checked ahead of the Secrets Manager write (not after) -- never
        # orphan a secret for a project that turns out not to exist.
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    secret_ref = build_scm_secret_ref(
        tenant_id=principal.tenant_id, project_iri=project_iri, provider=body.provider
    )
    await put_scm_token(secret_ref, body.token)  # AC-1: value never returns from here

    async with tenant_connection(principal.tenant_id) as conn:
        await set_row(
            conn,
            tenant_id=principal.tenant_id,
            project_iri=project_iri,
            provider=body.provider,
            token_secret_ref=secret_ref,
        )
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type=CONFIGURED_EVENT_TYPE,
                actor_iri=principal.principal_iri,
                subject_iri=project_iri,
                payload={"provider": body.provider, "token_secret_ref": secret_ref},  # never value
                engine="build",
            ),
        )
        meta = await get_configured_meta(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )

    return SourceControlResponse(
        provider=body.provider,
        token_secret_ref=secret_ref,
        configured_by=meta.configured_by if meta else principal.principal_iri,
        configured_at=meta.configured_at if meta else "",
    )
