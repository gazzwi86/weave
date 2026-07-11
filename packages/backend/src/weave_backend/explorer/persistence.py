"""TASK-025: shared plumbing for the Explorer Persistence Service
(`routers/views.py`, `routers/comments.py`) -- the RLS/txn connection helper
both routers need, plus the two PLAT-SETTINGS-1-cascade stubs the task
brief's pseudocode calls by name (`is_tenant_admin`/`has_graph_access`).

`explorer_connection` copies `routers/layout.py::_layout_connection`
verbatim (ADR-017 convention: GUC inside txn, asyncpg only, `app.current_tenant_id`
RLS key) -- split into its own module because two routers need it here,
whereas `layout.py` keeps its private copy untouched (Law 3: touch only what
you must).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import HTTPException

from weave_backend.db.pool import get_app_pool, tenant_connection
from weave_backend.identity.registry import PrincipalNotFound, get_principal


@asynccontextmanager
async def explorer_connection(tenant_id: str) -> AsyncIterator[asyncpg.Connection]:
    try:
        pool = await get_app_pool()
        async with pool.acquire() as conn, conn.transaction():
            await conn.execute("SELECT set_config('app.current_tenant_id', $1, true)", tenant_id)
            yield conn
    except asyncpg.PostgresError as exc:
        raise HTTPException(503, {"error": "store_unavailable"}) from exc


async def has_graph_access(tenant_id: str, recipient_iri: str) -> bool:
    """AC-5 / m2-delta-explorer.md §3: PLAT-SETTINGS-1 resolution stub --
    same stub surface as the tenant-admin check (`rbac.has_admin_grant`),
    real cascade resolution is out of this task's scope. A recipient with an
    active workspace membership is treated as having graph access; an
    unknown principal or one with no active membership does not.
    """
    async with tenant_connection(tenant_id) as conn:
        try:
            principal = await get_principal(conn, tenant_id=tenant_id, iri=recipient_iri)
        except PrincipalNotFound:
            return False
        return len(principal.workspace_memberships) > 0
