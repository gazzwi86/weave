"""AC-3: the single authoritative role hierarchy, plus the FastAPI dependency
factories that gate a `{workspace_id}`-scoped or tenant-wide route on a
caller's role. RBAC is dependency-by-default (see `auth/public.py`) -- these
are the "default" side of that contract, and the same path for both human
and agent principals (no branching on `principal_type` anywhere below).
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

import asyncpg
from fastapi import Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.tenancy.workspaces import get_workspace

ROLE_RANK: dict[str, int] = {"read": 0, "author": 1, "publish": 2, "admin": 3}


class InsufficientRole(HTTPException):
    def __init__(self, required_role: str) -> None:
        super().__init__(
            status_code=403, detail={"error": "forbidden", "required_role": required_role}
        )


def check_role(actual_role: str | None, required_role: str) -> None:
    """Pure decision: raises `InsufficientRole` unless `actual_role` outranks
    (or equals) `required_role` in `ROLE_RANK`. A missing or unrecognised
    role is always insufficient, never a `KeyError`.
    """
    if actual_role not in ROLE_RANK or ROLE_RANK[actual_role] < ROLE_RANK[required_role]:
        raise InsufficientRole(required_role)


async def resolve_workspace_role(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, user_sub: str
) -> str | None:
    row = await conn.fetchrow(
        "SELECT role FROM workspace_members"
        " WHERE tenant_id = $1 AND workspace_id = $2 AND user_sub = $3 AND status = 'active'",
        tenant_id,
        workspace_id,
        user_sub,
    )
    return str(row["role"]) if row is not None else None


async def is_tenant_admin(conn: asyncpg.Connection, *, tenant_id: str, user_sub: str) -> bool:
    row = await conn.fetchrow(
        "SELECT 1 FROM workspace_members"
        " WHERE tenant_id = $1 AND user_sub = $2 AND role = 'admin' AND status = 'active'"
        " LIMIT 1",
        tenant_id,
        user_sub,
    )
    return row is not None


def require_workspace_role(
    min_role: str,
) -> Callable[..., Coroutine[Any, Any, Principal]]:
    """Dependency factory gating a `{workspace_id}`-path route on the caller
    having at least `min_role` there. Checks workspace ownership (404) before
    role (403) -- preserves the existing IDOR-test contract that a foreign
    workspace_id 404s rather than leaking its existence via a 403.
    """

    async def _dependency(
        workspace_id: str,
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> Principal:
        async with tenant_connection(principal.tenant_id) as conn:
            workspace = await get_workspace(
                conn, tenant_id=principal.tenant_id, workspace_id=workspace_id
            )
            if workspace is None:
                raise HTTPException(status_code=404, detail={"error": "workspace_not_found"})
            role = await resolve_workspace_role(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                user_sub=principal.sub,
            )
        check_role(role, min_role)
        return principal

    return _dependency


async def require_tenant_admin(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Principal:
    """AC-6: gates a tenant-wide (not workspace-scoped) admin-only route."""
    async with tenant_connection(principal.tenant_id) as conn:
        admin = await is_tenant_admin(conn, tenant_id=principal.tenant_id, user_sub=principal.sub)
    if not admin:
        raise InsufficientRole("admin")
    return principal
