"""TASK-025: Explorer Persistence Service -- saved views (`explorer_saved_views`,
migration 0063), extending the M1 Layout Persistence Service into the same
FastAPI container (m2-delta-explorer.md §3). See ADR-025 for the tenant_id
TEXT / RLS-key divergence from the spec's literal DDL, the `workspace_id`
snapshot-row sentinel, and why AC-4's admin check reads
`rbac.has_admin_grant` (the JWT `roles` claim) rather than the DB-backed
`rbac.is_tenant_admin`.
"""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.explorer.persistence import explorer_connection, has_graph_access
from weave_backend.notifications.dispatch import dispatch_notification
from weave_backend.notifications.store import NotificationEvent
from weave_backend.rbac import has_admin_grant
from weave_backend.schemas.views import (
    PinRequest,
    ShareRequest,
    ShareResponse,
    ViewCreateRequest,
    ViewOut,
    ViewPositionIn,
)

router = APIRouter(prefix="/api", tags=["views"])

#: AC-7: tunable pin limit -- no config cascade exists yet for this, a
#: module constant is the honest M2 state until PLAT-SETTINGS-1 carries one.
#: ponytail: module constant, wire to config cascade if tunability is ever exercised.
PIN_LIMIT = 5

#: view-snapshot rows have no real M1 workspace concept (ADR-025 decision 2)
#: -- reads/deletes never key off this column, it only satisfies NOT NULL.
_SNAPSHOT_WORKSPACE_SENTINEL = "00000000-0000-0000-0000-000000000000"
#: ponytail: chunked multi-VALUES insert; COPY if p95 misses (ADR-025).
_SNAPSHOT_CHUNK_SIZE = 1000

_SELECT_EXISTING_BY_NAME_SQL = """
    SELECT view_id FROM explorer_saved_views WHERE tenant_id = $1 AND name = $2
"""
_SELECT_VIEW_SQL = """
    SELECT view_id, created_by FROM explorer_saved_views WHERE tenant_id = $1 AND view_id = $2
"""
_INSERT_VIEW_SQL = """
    INSERT INTO explorer_saved_views (tenant_id, view_id, name, created_by, definition)
    VALUES ($1, gen_random_uuid(), $2, $3, $4::jsonb)
    RETURNING view_id
"""
_UPDATE_VIEW_SQL = """
    UPDATE explorer_saved_views SET definition = $3::jsonb, updated_at = now()
    WHERE tenant_id = $1 AND view_id = $2
"""
_LIST_VIEWS_SQL = """
    SELECT view_id, name, created_by, pinned, updated_at
    FROM explorer_saved_views WHERE tenant_id = $1 ORDER BY updated_at DESC
"""
_DELETE_VIEW_SQL = "DELETE FROM explorer_saved_views WHERE tenant_id = $1 AND view_id = $2"
_DELETE_SNAPSHOT_SQL = (
    "DELETE FROM explorer_layout_positions WHERE tenant_id = $1 AND graph_id = $2"
)
_COUNT_PINNED_SQL = (
    "SELECT count(*) FROM explorer_saved_views WHERE tenant_id = $1 AND pinned = true"
)
_SET_PINNED_SQL = """
    UPDATE explorer_saved_views SET pinned = $3, updated_at = now()
    WHERE tenant_id = $1 AND view_id = $2
"""


def _snapshot_graph_id(view_id: object) -> str:
    return f"view:{view_id}"


def _require_name(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise HTTPException(400, {"error": "missing_name"})
    return value


def _require_definition(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise HTTPException(422, {"error": "invalid_definition"})
    return value


def _is_admin(principal: Principal) -> bool:
    return has_admin_grant(principal.roles, domain=None)


async def _insert_snapshot_rows(
    conn: Any, tenant_id: str, graph_id: str, positions: list[ViewPositionIn]
) -> None:
    """AC-2: snapshot rows locked=true under `view:{id}`, chunked multi-VALUES
    (ADR-025) -- a single 10k-row statement would exceed Postgres's ~65535
    bind-parameter limit at 6 params/row.
    """
    for start in range(0, len(positions), _SNAPSHOT_CHUNK_SIZE):
        chunk = positions[start : start + _SNAPSHOT_CHUNK_SIZE]
        params: list[Any] = []
        rows_sql = []
        for i, pos in enumerate(chunk):
            base = i * 6
            rows_sql.append(
                f"(${base + 1}, ${base + 2}, ${base + 3}, ${base + 4}, ${base + 5}, "
                f"${base + 6}, true, now())"
            )
            params.extend(
                [
                    tenant_id,
                    _SNAPSHOT_WORKSPACE_SENTINEL,
                    graph_id,
                    pos.node_iri,
                    pos.position_x,
                    pos.position_y,
                ]
            )
        columns = (
            "tenant_id, workspace_id, graph_id, node_iri, position_x, position_y, locked, "
            "updated_at"
        )
        # columns/placeholders below are fixed literals; all row data is bound
        # via `params` ($N positional args), never interpolated.
        sql = (
            f"INSERT INTO explorer_layout_positions ({columns}) VALUES "  # noqa: S608 # nosec B608
            + ", ".join(rows_sql)
        )
        # sql = fixed column literals + $N placeholder ordinals only; all row
        # data is bound via *params (asyncpg) — no untrusted concatenation.
        await conn.execute(sql, *params)  # nosemgrep


@router.post("/views", status_code=201)
async def create_view(
    body: ViewCreateRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, str]:
    name = _require_name(body.name)
    definition = _require_definition(body.definition)

    async with explorer_connection(principal.tenant_id) as conn:
        existing = await conn.fetchrow(_SELECT_EXISTING_BY_NAME_SQL, principal.tenant_id, name)
        if existing and not body.overwrite:
            raise HTTPException(
                409, {"error": "name_collision", "existing_view_id": str(existing["view_id"])}
            )
        if existing:
            view_id = existing["view_id"]
            await conn.execute(
                _UPDATE_VIEW_SQL, principal.tenant_id, view_id, json.dumps(definition)
            )
        else:
            row = await conn.fetchrow(
                _INSERT_VIEW_SQL,
                principal.tenant_id,
                name,
                principal.principal_iri,
                json.dumps(definition),
            )
            view_id = row["view_id"]

        graph_id = _snapshot_graph_id(view_id)
        await conn.execute(_DELETE_SNAPSHOT_SQL, principal.tenant_id, graph_id)
        await _insert_snapshot_rows(conn, principal.tenant_id, graph_id, body.positions)

    return {"view_id": str(view_id)}


@router.get("/views", response_model=list[ViewOut])
async def list_views(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> list[ViewOut]:
    async with explorer_connection(principal.tenant_id) as conn:
        rows = await conn.fetch(_LIST_VIEWS_SQL, principal.tenant_id)
    return [
        ViewOut(
            view_id=str(row["view_id"]),
            name=row["name"],
            created_by=row["created_by"],
            pinned=row["pinned"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@router.delete("/views/{view_id}", status_code=204)
async def delete_view(
    view_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Response:
    async with explorer_connection(principal.tenant_id) as conn:
        row = await conn.fetchrow(_SELECT_VIEW_SQL, principal.tenant_id, view_id)
        if row is None:
            raise HTTPException(404, {"error": "view_not_found"})
        if row["created_by"] != principal.principal_iri and not _is_admin(principal):
            raise HTTPException(403, {"error": "forbidden"})
        await conn.execute(_DELETE_VIEW_SQL, principal.tenant_id, view_id)
        await conn.execute(_DELETE_SNAPSHOT_SQL, principal.tenant_id, _snapshot_graph_id(view_id))
    return Response(status_code=204)


@router.post("/views/{view_id}/share", status_code=202)
async def share_view(
    view_id: str,
    body: ShareRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ShareResponse:
    async with explorer_connection(principal.tenant_id) as conn:
        row = await conn.fetchrow(_SELECT_VIEW_SQL, principal.tenant_id, view_id)
    if row is None:
        raise HTTPException(404, {"error": "view_not_found"})

    eligible = [r for r in body.recipients if await has_graph_access(principal.tenant_id, r)]
    # dispatch_notification/`notifications` RLS keys off the platform-wide
    # `app.tenant_id` GUC (not this router's `app.current_tenant_id`), so
    # this step needs a real `tenant_connection` -- see explorer/persistence.py.
    async with tenant_connection(principal.tenant_id) as notify_conn:
        for recipient in eligible:
            await dispatch_notification(
                notify_conn,
                NotificationEvent(
                    tenant_id=principal.tenant_id,
                    recipient_iri=recipient,
                    event_type="explorer.view-shared",
                    payload={"view_id": view_id},
                    actor_iri=principal.principal_iri,
                ),
            )
    return ShareResponse(notified=len(eligible), excluded=len(body.recipients) - len(eligible))


@router.patch("/views/{view_id}/pin")
async def pin_view(
    view_id: str,
    body: PinRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, Any]:
    if not _is_admin(principal):
        raise HTTPException(403, {"error": "forbidden"})

    async with explorer_connection(principal.tenant_id) as conn:
        row = await conn.fetchrow(_SELECT_VIEW_SQL, principal.tenant_id, view_id)
        if row is None:
            raise HTTPException(404, {"error": "view_not_found"})
        if body.pinned:
            count = await conn.fetchval(_COUNT_PINNED_SQL, principal.tenant_id)
            if count >= PIN_LIMIT:
                raise HTTPException(409, {"error": "pin_limit_reached", "limit": PIN_LIMIT})
        await conn.execute(_SET_PINNED_SQL, principal.tenant_id, view_id, body.pinned)

    return {"view_id": view_id, "pinned": body.pinned}
