"""CE-EVENT-1 beta transport: `GET /api/events` read surface (AC-008-04/
-05/-07). Open to any authenticated tenant member -- events carry entity
IRIs and actors, nothing more sensitive than what CE-READ-1 already
exposes, so unlike PLAT-AUDIT-1 there's no tenant-admin gate here.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.operations.events import read_events
from weave_backend.schemas.events import EventEntry, EventsQueryParams, EventsResponse

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=EventsResponse)
async def list_events_route(
    params: Annotated[EventsQueryParams, Query()],
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> EventsResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        page = await read_events(
            conn,
            tenant_id=principal.tenant_id,
            since_seq=params.since_seq,
            limit=params.limit,
        )
    if page.aged_out:
        # AC-008-05: never a silently empty page standing in for real data
        # loss -- the consumer re-baselines via CE-READ-1.
        raise HTTPException(status_code=410, detail={"error": "cursor_aged_out"})
    return EventsResponse(
        events=[EventEntry(**dict(row)) for row in page.events],
        latest_seq=page.latest_seq,
    )
