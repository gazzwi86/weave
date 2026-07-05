"""CE-WRITE-1: `POST /api/operations/apply` -- the single validated mutation
entry point (AC-001-01..10). No other route may write to a working graph;
that's the point (single validated entry point, no bypass path).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations.pipeline import (
    ApplyContext,
    InvalidTargetError,
    apply_operations_request,
)
from weave_backend.rbac import enforce_workspace_role
from weave_backend.schemas.operations import ApplyRequest, ApplyResponse, ViolationsResponse
from weave_backend.tenancy.sessions import get_active_workspace, get_redis
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api", tags=["operations"])


@router.post(
    "/operations/apply",
    response_model=ApplyResponse,
    status_code=201,
    responses={422: {"model": ViolationsResponse}},
)
async def apply_operations_route(
    body: ApplyRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ApplyResponse | JSONResponse:
    # AC-001-07 (401) is satisfied by the `get_current_principal` dependency
    # itself -- it raises before this body ever runs.
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise HTTPException(status_code=400, detail={"error": "no_active_workspace"})

    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
        # AC-001-08 (403): raises `InsufficientRole` (an `HTTPException`) if
        # the caller's role in their own workspace is below "author".
        await enforce_workspace_role(
            conn,
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            user_sub=principal.sub,
            min_role="author",
        )
        ctx = ApplyContext(
            tenant_id=principal.tenant_id,
            workspace_id=workspace_id,
            named_graph_iri=workspace.named_graph_iri,
            conn=conn,
        )
        try:
            result = await apply_operations_request(ctx, body, get_redis())
        except InvalidTargetError as exc:
            # AC-001-09: `target` named a graph outside the caller's own
            # workspace -- structurally can't belong to another tenant's
            # graph either, since `named_graph_iri` already embeds tenant_id.
            raise HTTPException(status_code=400, detail={"error": "invalid_target"}) from exc

    if isinstance(result, ViolationsResponse):
        # CE-WRITE-1 contract: `422 { violations: [...] }` at the top level --
        # not wrapped in FastAPI's default `{"detail": ...}` envelope, so
        # `HTTPException` (which always wraps) isn't used here.
        return JSONResponse(status_code=422, content=result.model_dump())
    return result
