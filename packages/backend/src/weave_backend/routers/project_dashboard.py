"""BE-V1-TASK-019 (FR-013): `GET
/api/projects/{project_iri}/dashboard/{tile}` -- read-only, so no
request-body schema is needed (Law 13 N/A here, same as `routers/costs.py`).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.costs import RollupUnavailable
from weave_backend.build.dashboard import ProjectNotFound, UnknownTile, get_tile_payload
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.project_dashboard import TILE_NAMES

router = APIRouter(prefix="/api/projects", tags=["dashboard"])


@router.get("/{project_iri}/dashboard/{tile}")
async def get_dashboard_tile_route(
    project_iri: str,
    tile: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> object:
    # AC-1: unknown tile is a 400 -- checked before opening a DB connection,
    # so a bad `tile` segment never costs a round trip.
    if tile not in TILE_NAMES:
        raise HTTPException(status_code=400, detail={"error": "unknown_tile"})

    async with tenant_connection(principal.tenant_id) as conn:
        try:
            return await get_tile_payload(
                conn, tenant_id=principal.tenant_id, project_iri=project_iri, tile=tile
            )
        except UnknownTile as exc:
            raise HTTPException(status_code=400, detail={"error": "unknown_tile"}) from exc
        except ProjectNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except RollupUnavailable as exc:
            raise HTTPException(
                status_code=503, detail={"error": "costs_rollup_unavailable"}
            ) from exc
