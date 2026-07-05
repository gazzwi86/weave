"""AC-2..AC-6: `POST /api/tasks/{task_id}/result`, `POST /api/tasks/{task_id}/hitl`
(BE-TASK-005, build-engine EPIC-006).
"""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.hitl import (
    HitlGateClosedError,
    HitlResponseContext,
    SelfApprovalNotPermitted,
    handle_hitl_response,
)
from weave_backend.build.store import TaskNotFound
from weave_backend.build.typed_result import AgentResultContext, handle_agent_result
from weave_backend.db.pool import tenant_connection
from weave_backend.routers.projects import projects_validation_error_handler
from weave_backend.schemas.tasks import (
    AgentResultResponse,
    HitlActionRequest,
    HitlActionResponse,
    TypedResult,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def tasks_validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Normalises this router's 422 bodies to `{"error": "validation_error",
    "field": <name>}` (AC-6's `/hitl` shape; also covers `/result`'s
    `TypedResult` cross-field check). Only one handler can be registered
    per exception class (`app.add_exception_handler` overwrites, it does
    not chain) -- so a path outside this router's prefix falls through to
    `projects_validation_error_handler`, which in turn falls back to
    FastAPI's own default for everything else.
    """
    validation_exc = cast("RequestValidationError", exc)
    if not request.url.path.startswith(router.prefix):
        return await projects_validation_error_handler(request, validation_exc)
    errors = validation_exc.errors()
    field = str(errors[0]["loc"][-1]) if errors else "unknown"
    detail = {"error": "validation_error", "field": field}
    return JSONResponse(status_code=422, content={"detail": detail})


@router.post("/{task_id}/result", response_model=AgentResultResponse)
async def submit_task_result_route(
    task_id: str,
    body: TypedResult,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> AgentResultResponse:
    ctx = AgentResultContext(
        tenant_id=principal.tenant_id,
        actor_iri=principal.principal_iri,
        task_id=task_id,
        result=body,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            outcome = await handle_agent_result(conn, ctx)
        except TaskNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except HitlGateClosedError as exc:
            raise HTTPException(
                status_code=503, detail={"error": "hitl_gate_closed"}
            ) from exc

    return AgentResultResponse(**outcome)


@router.post("/{task_id}/hitl", response_model=HitlActionResponse)
async def submit_hitl_action_route(
    task_id: str,
    body: HitlActionRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> HitlActionResponse:
    ctx = HitlResponseContext(
        tenant_id=principal.tenant_id,
        task_id=task_id,
        approving_principal_iri=principal.principal_iri,
        action=body.action,
        amendment=body.amendment,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            outcome = await handle_hitl_response(conn, ctx)
        except TaskNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except SelfApprovalNotPermitted as exc:
            raise HTTPException(
                status_code=403, detail={"error": "self_approval_not_permitted"}
            ) from exc

    return HitlActionResponse.model_validate(outcome)
