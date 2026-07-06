"""TASK-004: server-side layout persistence -- `explorer_layout_positions`
(migration 0008, ADR-001-approved schema) scoped by
`(tenant_id, workspace_id, graph_id, node_iri)`.

ADR-004 documents three deliberate departures from the brief's generic
pseudocode: asyncpg (not SQLAlchemy -- no router in this codebase uses an
ORM), `workspace_id` resolved via the same active-session fallback AND the
same `get_workspace`/`enforce_workspace_role` membership check
`sparql.py::_resolve_named_graph`/`search.py::_authorize_search` already use
(QA FAIL fix: the membership check was originally dropped, an IDOR -- see
`_authorize_workspace` below), and a dedicated `_layout_connection` helper
targeting this table's `app.current_tenant_id` RLS key (distinct from the
platform's `app.tenant_id`, which `workspaces`/`workspace_members` RLS keys
off -- `_authorize_workspace` uses the real `tenant_connection` for that
reason, never `_layout_connection`).

Flat error bodies: FastAPI's `HTTPException(detail=...)` always nests the
body under a `"detail"` key, which cannot produce this task's mandated
top-level `{"error": ...}` shape. `LayoutApiError` + the registered
exception handler below is a narrow, this-router-only mechanism for that --
it does not touch the shared `get_current_principal` 401 path (out of
scope; see the TASK-004 progress summary for the cross-cutting 401-shape
gap already tracked elsewhere in this codebase's history).
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import get_app_pool, tenant_connection
from weave_backend.rbac import enforce_workspace_role
from weave_backend.schemas.layout import (
    LayoutPositionOut,
    LayoutPositionsResponse,
    LayoutSaveRequest,
)
from weave_backend.tenancy.sessions import get_active_workspace
from weave_backend.tenancy.workspaces import get_workspace

router = APIRouter(prefix="/api", tags=["layout"])

_IRI_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")

_UPSERT_SQL = """
    INSERT INTO explorer_layout_positions
        (tenant_id, workspace_id, graph_id, node_iri, position_x, position_y, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (tenant_id, workspace_id, graph_id, node_iri)
    DO UPDATE SET
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        updated_at = now()
"""

_SELECT_SQL = """
    SELECT node_iri, position_x, position_y, locked
    FROM explorer_layout_positions
    WHERE tenant_id = $1 AND workspace_id = $2 AND graph_id = $3
"""

_DELETE_SQL = """
    DELETE FROM explorer_layout_positions
    WHERE tenant_id = $1 AND workspace_id = $2 AND graph_id = $3
"""


class LayoutApiError(Exception):
    """Carries the brief-mandated flat error body straight to the
    registered exception handler, bypassing FastAPI's nested-under-`detail`
    default."""

    def __init__(self, status_code: int, body: dict[str, str]) -> None:
        super().__init__(body)
        self.status_code = status_code
        self.body = body


async def layout_api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Starlette's exception-handler signature is contravariant on Exception --
    # only ever invoked for LayoutApiError since that's the only type this
    # handler is registered against (see __init__.py).
    if not isinstance(exc, LayoutApiError):
        raise TypeError("layout_api_error_handler registered for a non-LayoutApiError exception")
    return JSONResponse(status_code=exc.status_code, content=exc.body)


@asynccontextmanager
async def _layout_connection(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Mirrors `db.pool.tenant_connection` but sets this table's own RLS key,
    `app.current_tenant_id` (ADR-004 decision 3) -- a distinct config key from
    the platform's `app.tenant_id`, though both are TEXT and `missing_ok=true`
    since migration 0014 (the column/cast used to be UUID-only, see that
    migration's comment). Any asyncpg failure (e.g. unreachable Aurora)
    surfaces as 503, never a raw 500.
    """
    try:
        pool = await get_app_pool()
        async with pool.acquire() as conn, conn.transaction():
            await conn.execute("SELECT set_config('app.current_tenant_id', $1, true)", tenant_id)
            yield conn
    except asyncpg.PostgresError as exc:
        raise LayoutApiError(503, {"error": "store_unavailable"}) from exc


def _require_non_empty(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise LayoutApiError(422, {"error": "missing_field", "field": field})
    return value


def _require_iri(value: Any) -> str:
    if not isinstance(value, str) or not _IRI_SCHEME_RE.match(value):
        raise LayoutApiError(422, {"error": "invalid_iri", "field": "node_iri"})
    return value


def _require_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise LayoutApiError(422, {"error": "invalid_position", "field": field})
    return float(value)


def _reject_locked_field(body: LayoutSaveRequest) -> None:
    if body.model_extra and "locked" in body.model_extra:
        raise LayoutApiError(422, {"error": "field_not_allowed", "field": "locked"})


def _check_tenant_match(claimed: str | None, actual: str) -> None:
    if claimed is not None and claimed != actual:
        raise LayoutApiError(403, {"error": "forbidden"})


async def _authorize_workspace(principal: Principal, workspace_id: str) -> None:
    """QA FAIL fix (IDOR): copies the exact pattern `sparql.py::_resolve_named_graph`
    and `search.py::_authorize_search` already use -- 404 on a foreign/missing
    workspace before the 403 role check (never leak existence via the
    role-check branch), on a real `tenant_connection` (not this router's own
    `_layout_connection`: `workspaces`/`workspace_members` RLS keys off
    `app.tenant_id`, which only `tenant_connection` sets -- `_layout_connection`
    sets the table-specific `app.current_tenant_id` instead, so reusing it here
    would leave `app.tenant_id` unset and RLS would hide every row). Both of
    `enforce_workspace_role`'s and `HTTPException`'s bodies are nested under
    `"detail"` -- translated here to this router's flat-body convention.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        workspace = await get_workspace(
            conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
        )
        if workspace is None:
            raise LayoutApiError(404, {"error": "workspace_not_found"})
        try:
            await enforce_workspace_role(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                user_sub=principal.sub,
                min_role="read",
            )
        except HTTPException as exc:
            raise LayoutApiError(403, {"error": "forbidden"}) from exc


async def _resolve_workspace_id(requested: str | None, principal: Principal) -> str:
    workspace_id = requested or await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        raise LayoutApiError(422, {"error": "missing_workspace_id"})
    await _authorize_workspace(principal, workspace_id)
    return workspace_id


@router.post("/layout/positions", status_code=204)
async def save_position(
    body: LayoutSaveRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Response:
    _reject_locked_field(body)
    _check_tenant_match(body.tenant_id, principal.tenant_id)
    graph_id = _require_non_empty(body.graph_id, "graph_id")
    node_iri = _require_iri(body.node_iri)
    position_x = _require_number(body.position_x, "position_x")
    position_y = _require_number(body.position_y, "position_y")
    workspace_id = await _resolve_workspace_id(body.workspace_id, principal)

    async with _layout_connection(principal.tenant_id) as conn:
        await conn.execute(
            _UPSERT_SQL,
            principal.tenant_id,
            workspace_id,
            graph_id,
            node_iri,
            position_x,
            position_y,
        )
    return Response(status_code=204)


@router.get("/layout/positions", response_model=LayoutPositionsResponse)
async def get_positions(
    principal: Annotated[Principal, Depends(get_current_principal)],
    graph_id: str = Query(default=""),
    workspace_id: str | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
) -> LayoutPositionsResponse:
    _check_tenant_match(tenant_id, principal.tenant_id)
    graph_id = _require_non_empty(graph_id, "graph_id")
    resolved_workspace_id = await _resolve_workspace_id(workspace_id, principal)

    async with _layout_connection(principal.tenant_id) as conn:
        rows = await conn.fetch(_SELECT_SQL, principal.tenant_id, resolved_workspace_id, graph_id)
    positions = [
        LayoutPositionOut(
            node_iri=row["node_iri"],
            position_x=row["position_x"],
            position_y=row["position_y"],
            locked=row["locked"],
        )
        for row in rows
    ]
    return LayoutPositionsResponse(positions=positions)


@router.delete("/layout/positions", status_code=204)
async def reset_layout(
    principal: Annotated[Principal, Depends(get_current_principal)],
    graph_id: str = Query(default=""),
    workspace_id: str | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
) -> Response:
    _check_tenant_match(tenant_id, principal.tenant_id)
    graph_id = _require_non_empty(graph_id, "graph_id")
    resolved_workspace_id = await _resolve_workspace_id(workspace_id, principal)

    async with _layout_connection(principal.tenant_id) as conn:
        await conn.execute(_DELETE_SQL, principal.tenant_id, resolved_workspace_id, graph_id)
    return Response(status_code=204)
