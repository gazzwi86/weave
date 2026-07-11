"""AC-2/AC-5/AC-6: notification centre + preferences routes (PLAT-NOTIFY-1).
Per-user, tenant-scoped -- unlike settings/search there's no workspace-role
gate: a principal only ever sees/mutates rows keyed by their own
`recipient_iri`, so `get_current_principal` + RLS is the whole authz story.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.notifications import store
from weave_backend.notifications.defaults import NOTIFICATION_TYPES, default_in_app_types
from weave_backend.notifications.store import NotificationQuery
from weave_backend.rbac import resolve_workspace_role
from weave_backend.schemas.notifications import (
    MarkReadResponse,
    NotificationListResponse,
    NotificationOut,
    PreferencesResponse,
    PreferencesUpdateRequest,
    PreferencesUpdateResponse,
    PreferenceTypeOut,
)
from weave_backend.tenancy.sessions import get_active_workspace

router = APIRouter(prefix="/api", tags=["notifications"])


async def _resolve_principal_role(conn: asyncpg.Connection, principal: Principal) -> str | None:
    """TASK-030 AC-4: the caller's role in their active workspace, or `None`
    before their first `/switch` (no workspace to resolve a role in yet) --
    `default_in_app_types(None)` falls back to the baseline in that case.
    """
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        return None
    return await resolve_workspace_role(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, user_sub=principal.sub
    )


@router.get("/notifications/preferences", response_model=PreferencesResponse)
async def get_preferences_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> PreferencesResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        role = await _resolve_principal_role(conn, principal)
        defaults = default_in_app_types(role)
        types = []
        for spec in NOTIFICATION_TYPES:
            stored = await store.get_stored_channels(
                conn,
                tenant_id=principal.tenant_id,
                recipient_iri=principal.principal_iri,
                event_type=spec.event_type,
            )
            in_app_enabled = (
                "in_app" in stored if stored is not None else spec.event_type in defaults
            )
            types.append(
                PreferenceTypeOut(
                    event_type=spec.event_type,
                    group=spec.group,
                    in_app_enabled=in_app_enabled,
                )
            )
    return PreferencesResponse(types=types)


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    unread: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> NotificationListResponse:
    query = NotificationQuery(
        tenant_id=principal.tenant_id,
        recipient_iri=principal.principal_iri,
        unread_only=unread,
        page=page,
        per_page=per_page,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        records, total = await store.list_notifications(conn, query)
    return NotificationListResponse(
        notifications=[NotificationOut(**record.model_dump()) for record in records],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.put("/notifications/preferences", response_model=PreferencesUpdateResponse)
async def update_preferences_route(
    body: PreferencesUpdateRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> PreferencesUpdateResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            await store.upsert_pref(
                conn,
                tenant_id=principal.tenant_id,
                recipient_iri=principal.principal_iri,
                event_type=body.event_type,
                channels=body.channels,
            )
        except store.BadRequest as exc:
            raise HTTPException(status_code=400, detail={"error": exc.error}) from exc
    return PreferencesUpdateResponse(saved=True)


@router.post("/notifications/{notif_id}/read", response_model=MarkReadResponse)
async def mark_read_route(
    notif_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> MarkReadResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        found = await store.mark_read(
            conn,
            tenant_id=principal.tenant_id,
            recipient_iri=principal.principal_iri,
            notif_id=notif_id,
        )
    if not found:
        raise HTTPException(status_code=404, detail={"error": "notification_not_found"})
    return MarkReadResponse(id=notif_id, read=True)
