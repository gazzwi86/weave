"""CE-FUNCTION-1 (TASK-009 AC-009-02/-03/-06/-08): read-only function
registry surface -- `GET /api/functions` (list), `GET /api/functions/{iri}`
(detail). Writes go through CE-WRITE-1 only (`POST /api/operations/apply`);
there is deliberately no POST/PUT route under `/api/functions*` (DoD
invariant -- the registry is a derived projection, never a second write
path).
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.functions.registry import get_function, list_functions
from weave_backend.operations.versioning import VersionNotFound
from weave_backend.rbac import InsufficientRole, enforce_workspace_role
from weave_backend.schemas.functions import FunctionDetail, FunctionsListResponse
from weave_backend.tenancy.sessions import get_active_workspace

router = APIRouter(prefix="/api", tags=["functions"])


async def _resolve_workspace_id(principal: Principal, requested: str | None) -> str:
    workspace_id = requested or await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})
    return workspace_id


async def _authorize_read(
    conn: asyncpg.Connection, *, principal: Principal, workspace_id: str
) -> None:
    try:
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="read",
        )
    except InsufficientRole as exc:
        raise HTTPException(status_code=403, detail={"error": "forbidden"}) from exc


@router.get("/functions", response_model=FunctionsListResponse)
async def list_functions_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    workspace_id: str | None = Query(default=None),
) -> FunctionsListResponse:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)
    async with tenant_connection(principal.tenant_id) as conn:
        await _authorize_read(conn, principal=principal, workspace_id=resolved_workspace_id)
        try:
            entries = await list_functions(
                conn, tenant_id=principal.tenant_id, workspace_id=resolved_workspace_id
            )
        except VersionNotFound:
            # No commit at all in this workspace yet -- an empty registry,
            # not an error (nothing has ever been defined).
            entries = []
    return FunctionsListResponse(functions=entries)


@router.get("/functions/{fn_iri:path}", response_model=FunctionDetail)
async def get_function_route(
    fn_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    workspace_id: str | None = Query(default=None),
) -> FunctionDetail:
    resolved_workspace_id = await _resolve_workspace_id(principal, workspace_id)
    async with tenant_connection(principal.tenant_id) as conn:
        await _authorize_read(conn, principal=principal, workspace_id=resolved_workspace_id)
        try:
            detail = await get_function(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=resolved_workspace_id,
                fn_iri=fn_iri,
            )
        except VersionNotFound:
            detail = None
    if detail is None:
        raise HTTPException(status_code=404, detail={"error": "function_not_found"})
    return detail
