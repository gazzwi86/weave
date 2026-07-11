"""PLAT-V1-TASK-024 AC-1/AC-6: `GET /api/proxy/events` -- the tenant-scoped
platform proxy over CE-EVENT-1 the recent-edits widget polls. Cognito JWT +
RBAC via the M1 `get_current_principal` dependency; tenant comes from the
principal, never a query param (cross-tenant-read test family).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.dashboard.events_proxy import proxy_events
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.events import EventEntry, EventsQueryParams, EventsResponse

router = APIRouter(prefix="/api/proxy", tags=["dashboard"])


@router.get("/events", response_model=EventsResponse)
async def proxy_events_route(
    params: Annotated[EventsQueryParams, Query()],
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> EventsResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        result = await proxy_events(
            conn, tenant_id=principal.tenant_id, since_seq=params.since_seq, limit=params.limit
        )
    if result.gone:
        # AC-3: never a silent empty page -- the client re-baselines via CE-READ-1.
        raise HTTPException(status_code=410, detail={"error": "cursor_aged_out"})
    return EventsResponse(
        events=[EventEntry(**dict(row)) for row in result.rows],
        latest_seq=result.latest_seq,
    )
