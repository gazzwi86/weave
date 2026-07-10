"""TASK-022 (FR-010, build-engine EPIC-002): `.../bindings` thin CRUD over
`pm/bindings.py` + the PLAT-CONNECTOR-1 instance-registry/health-read seam
(`connectors/client.py`). Mutations (`PUT`/`DELETE`) go through
`Depends(require_project_role(ProjectAction.BINDINGS))` -- admin-only
(AC-5). The list read carries no guard, same as every other PM read
(tenant membership is sufficient). Build never holds connector credentials
or calls a space-level external API -- `space_ref` validity is the
connector's problem, not Build's (API contract note).
"""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.connectors.client import default_connector_client
from weave_backend.db.pool import tenant_connection
from weave_backend.pm.bindings import Binding, DuplicateBinding, NewBinding, delete, get_all, put
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.bindings import (
    BindingListResponse,
    BindingResponse,
    BindRequest,
    HealthResponse,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])

# AC-3 / API Contract: "a slow connector degrades one badge, not the request"
# (p95 <= 400ms for the whole GET). 50ms per read keeps several rows well
# inside that budget while still giving a real connector room to answer.
_HEALTH_READ_TIMEOUT_SECONDS = 0.05


async def _read_health(connector_ref: str) -> HealthResponse:
    """AC-3: per-row isolation -- one slow/broken connector's health read
    must never drag down (or 500) the whole bindings tab. Any failure --
    timeout, connector error, anything -- reads as "unavailable", never a
    fake "ok".
    """
    try:
        health = await asyncio.wait_for(
            default_connector_client.health(connector_ref), timeout=_HEALTH_READ_TIMEOUT_SECONDS
        )
    except Exception:  # AC-3: every failure mode (incl. timeout) -> unavailable, isolated per row
        return HealthResponse(status="unavailable")
    return HealthResponse(
        status=health.status,
        last_sync=health.last_sync,
        last_error=health.last_error,
        error_count=health.error_count,
        skipped_count=health.skipped_count,
    )


def _to_response(binding: Binding, health: HealthResponse) -> BindingResponse:
    return BindingResponse(
        binding_id=binding.binding_id,
        system=binding.system,
        connector_ref=binding.connector_ref,
        space_ref=binding.space_ref,
        created_by=binding.created_by,
        created_at=binding.created_at,
        health=health,
    )


@router.get("/{project_iri}/bindings", response_model=BindingListResponse)
async def list_bindings_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> BindingListResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        rows = await get_all(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
    healths = await asyncio.gather(*(_read_health(row.connector_ref) for row in rows))
    return BindingListResponse(
        items=[_to_response(row, health) for row, health in zip(rows, healths, strict=True)]
    )


@router.put("/{project_iri}/bindings", response_model=BindingResponse, status_code=201)
async def bind_route(
    project_iri: str,
    body: BindRequest,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.BINDINGS))],
) -> BindingResponse:
    instances = await default_connector_client.list_instances(principal.tenant_id)
    available = [instance.handle for instance in instances]
    if body.connector_ref not in available:  # AC-2
        raise HTTPException(
            status_code=422,
            detail={"error": "unknown_instance", "available": available},
        )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            binding = await put(
                conn,
                tenant_id=principal.tenant_id,
                binding=NewBinding(
                    project_iri=project_iri,
                    system=body.system,
                    connector_ref=body.connector_ref,
                    space_ref=body.space_ref,
                    created_by=principal.principal_iri,
                ),
            )
        except DuplicateBinding as exc:  # AC-4
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "duplicate_binding",
                    "system": exc.system,
                    "space_ref": exc.space_ref,
                },
            ) from exc
    health = await _read_health(binding.connector_ref)
    return _to_response(binding, health)


@router.delete("/{project_iri}/bindings/{binding_id}", status_code=204)
async def delete_binding_route(
    project_iri: str,
    binding_id: str,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.BINDINGS))],
) -> None:
    async with tenant_connection(principal.tenant_id) as conn:
        await delete(conn, tenant_id=principal.tenant_id, binding_id=binding_id)
