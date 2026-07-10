"""AC-3/AC-6/AC-7/AC-8: widget-state routes (PLAT-V1-TASK-010). Per-tenant,
RLS-backed, `get_current_principal` + RLS is the whole authz story for
`user`-scope rows (mirrors `routers/notifications.py`); `tenant_default` is
read-only here -- no route composes/reorders it (Design Decisions table).
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from httpx import AsyncClient

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.dashboard import store
from weave_backend.dashboard.ce_metrics import CeMetricsUnavailable, get_ce_metrics_client
from weave_backend.dashboard.ce_metrics import fetch as fetch_ce_metric
from weave_backend.dashboard.default_tiles import resolve_starter_role
from weave_backend.dashboard.status import WidgetFetchState, derive_status
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.dashboard import (
    WidgetListResponse,
    WidgetOut,
    WidgetRefreshResponse,
    WidgetStatus,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _to_widget_out(row: store.WidgetRow) -> WidgetOut:
    """AC-7 clause 2: re-derive `status` by age on every read, not just after
    a refresh attempt. Only when `fetched_at` is set -- a never-fetched
    widget has no payload to go stale, and `derive_status`'s
    `fetch_failed=False` path has no "never attempted" case of its own (it
    would otherwise default to `fresh`, clobbering the stored `unavailable`).
    """
    status: WidgetStatus = row.status  # type: ignore[assignment]
    pending_fields: list[str] = []
    if row.fetched_at is not None:
        derived = derive_status(
            spec_field=row.spec.bindings["field"],
            state=WidgetFetchState(
                last_result=row.last_result,
                fetched_at=row.fetched_at,
                refresh_interval_s=row.refresh_interval_s,
            ),
            fetch_failed=False,
            now=store.utcnow(),
        )
        status, pending_fields = derived.status, derived.pending_fields

    return WidgetOut(
        id=row.id,
        scope=row.scope,  # type: ignore[arg-type]
        spec=row.spec,
        position=row.position,
        last_result=row.last_result,
        fetched_at=row.fetched_at,
        status=status,
        pending_fields=pending_fields,
        suggested=row.suggested,
    )


@router.get("/widgets", response_model=WidgetListResponse)
async def list_widgets_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
    scope: Literal["tenant_default", "user"] = Query(default="tenant_default"),
) -> WidgetListResponse:
    """AC-2/AC-6/AC-8: pure SWR read, no upstream CE call. `user` scope
    lazily seeds role-appropriate starters on first read (AC-8); this is the
    endpoint that triggers that first-load seed -- not a separate route.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        if scope == "user":
            role = resolve_starter_role([grant.role for grant in principal.roles])
            await store.ensure_user_starters(
                conn,
                tenant_id=principal.tenant_id,
                owner_principal_iri=principal.principal_iri,
                role=role,
            )
        rows = await store.list_widgets(
            conn,
            tenant_id=principal.tenant_id,
            scope=scope,
            owner_principal_iri=principal.principal_iri if scope == "user" else None,
        )
    return WidgetListResponse(widgets=[_to_widget_out(row) for row in rows])


@router.post("/widgets/{widget_id}/refresh", response_model=WidgetRefreshResponse)
async def refresh_widget_route(
    widget_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    ce_client: Annotated[AsyncClient, Depends(get_ce_metrics_client)],
) -> WidgetRefreshResponse:
    """AC-4/AC-7: refresh attempt against CE-METRICS-1. Failure never blanks
    the tile -- prior `last_result`/`fetched_at` are retained and `status`
    becomes `stale`/`unavailable` per the honest-state matrix, never a 500.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        row = await store.get_widget(conn, tenant_id=principal.tenant_id, widget_id=widget_id)
        if row is None or (
            row.scope == "user" and row.owner_principal_iri != principal.principal_iri
        ):
            raise HTTPException(status_code=404)

        field_name = row.spec.bindings["field"]
        fetch_failed = False
        last_result = row.last_result
        fetched_at = row.fetched_at
        try:
            last_result = await fetch_ce_metric(ce_client, row.spec.bindings)
            fetched_at = store.utcnow()
        except CeMetricsUnavailable:
            fetch_failed = True

        derived = derive_status(
            spec_field=field_name,
            state=WidgetFetchState(
                last_result=last_result,
                fetched_at=fetched_at,
                refresh_interval_s=row.refresh_interval_s,
            ),
            fetch_failed=fetch_failed,
            now=store.utcnow(),
        )
        await store.apply_refresh_result(
            conn,
            tenant_id=principal.tenant_id,
            widget_id=widget_id,
            outcome=store.RefreshOutcome(
                last_result=last_result, status=derived.status, fetched_at=fetched_at
            ),
        )
    return WidgetRefreshResponse(status=derived.status, fetched_at=fetched_at)


@router.delete("/widgets/{widget_id}", status_code=204)
async def delete_widget_route(
    widget_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> None:
    """AC-8: starter removal / unpin -- user-scope + owner-only. 404 (not
    403) on someone else's or a `tenant_default` row: RLS already limits
    reads to this tenant, and not leaking existence of another user's
    private widget follows the same IDOR-safe precedent as notifications'
    mark-read route.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        row = await store.get_widget(conn, tenant_id=principal.tenant_id, widget_id=widget_id)
        if row is None or row.scope != "user" or row.owner_principal_iri != principal.principal_iri:
            raise HTTPException(status_code=404)
        deleted = await store.delete_widget(
            conn, tenant_id=principal.tenant_id, widget_id=widget_id
        )
        if not deleted:
            raise HTTPException(status_code=404)
