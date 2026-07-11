"""AC-3: the single authoritative role hierarchy, plus the FastAPI dependency
factories that gate a `{workspace_id}`-scoped or tenant-wide route on a
caller's role. RBAC is dependency-by-default (see `auth/public.py`) -- these
are the "default" side of that contract, and the same path for both human
and agent principals (no branching on `principal_type` anywhere below).
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Coroutine, Sequence
from enum import StrEnum
from typing import Annotated, Any

import asyncpg
from fastapi import Depends, HTTPException

from weave_backend.audit.emitter import AuditEmitter, AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, RoleGrant, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.pm.contributors import get_role as get_contributor_role
from weave_backend.tenancy.workspaces import get_workspace

log = logging.getLogger(__name__)

#: TASK-030 ADR-020: the legacy 4-tier ranks (M1) plus the 10 canonical
#: in-tenant role slugs (`weave-platform.md` "Canonical human roles"),
#: which TASK-030's invite role selector writes to `workspace_members.role`
#: going forward. Both vocabularies coexist in `ROLE_RANK` so a workspace
#: created before this task (still using "admin"/"author"/"read") and one
#: invited after it (using "workspace_admin"/"engineer"/...) rank
#: correctly against the same `require_workspace_role(min_role)` gates --
#: no migration of existing rows, no branching in `check_role`.
ROLE_RANK: dict[str, int] = {
    "read": 0,
    "author": 1,
    "publish": 2,
    "admin": 3,
    "viewer": 0,
    "automation_author": 1,
    "ops_sre": 1,
    "engineer": 1,
    "brand_content_owner": 1,
    "data_steward": 1,
    "business_analyst_sme": 1,
    "enterprise_architect": 2,
    "compliance_officer": 2,
    "workspace_admin": 3,
}


class ProjectAction(StrEnum):
    """TASK-011: mutation actions gated by `require_project_role`. Reads
    carry no guard (AC-5) -- tenant membership via `get_current_principal`
    is sufficient.
    """

    SETTINGS = "settings"
    CONTRIBUTORS = "contributors"
    BINDINGS = "bindings"
    BACKLOG = "backlog"
    SPECS = "specs"
    GENERATE = "generate"
    PROMPT = "prompt"


#: TASK-011 AC-1/AC-2: `admin`'s action set is a strict superset of `editor`'s.
PROJECT_ROLE_ACTIONS: dict[str, frozenset[ProjectAction]] = {
    "admin": frozenset(ProjectAction),
    "editor": frozenset(
        {ProjectAction.BACKLOG, ProjectAction.SPECS, ProjectAction.GENERATE, ProjectAction.PROMPT}
    ),
}

#: TASK-011 AC-4: role names in the JWT `roles` claim that overlay a
#: tenant/domain-wide admin grant over any per-project role.
_OVERLAY_ROLES = frozenset({"admin", "owner"})


class InsufficientProjectRole(HTTPException):
    def __init__(self, action: ProjectAction) -> None:
        super().__init__(status_code=403, detail={"error": "forbidden", "action": action.value})


def project_role_allows(role: str | None, action: ProjectAction) -> bool:
    if role is None:
        return False
    return action in PROJECT_ROLE_ACTIONS.get(role, frozenset())


def has_admin_grant(roles: Sequence[RoleGrant], *, domain: str | None) -> bool:
    """TASK-011 AC-4: a tenant-scope admin/owner grant always overlays; a
    domain-scope grant overlays only when `domain` (the project's
    `domain_iri`) is given and matches. `domain=None` at the route boundary
    is the honest M1 state -- `projects` carries no `domain_iri` column yet
    (see ADR) -- so only tenant-scope grants are live in production; the
    domain branch is unit-tested directly against AC-4's spec.
    """
    for grant in roles:
        if grant.role not in _OVERLAY_ROLES:
            continue
        if grant.scope == "tenant":
            return True
        if grant.scope == "domain" and domain is not None and grant.domain_iri == domain:
            return True
    return False


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


async def enforce_workspace_role(
    conn: asyncpg.Connection, *, tenant_id: str, workspace_id: str, user_sub: str, min_role: str
) -> None:
    """Same check `require_workspace_role` does, for routes whose
    workspace_id isn't a path param (settings' scope_iri/context, sparql's
    body/active-session workspace) -- the caller resolves workspace_id from
    its own scope IRI first, then calls through here. A missing membership
    row (`role is None`) is rejected the same as an insufficient one, via
    `check_role`.
    """
    role = await resolve_workspace_role(
        conn, tenant_id=tenant_id, workspace_id=workspace_id, user_sub=user_sub
    )
    check_role(role, min_role)


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
            await enforce_workspace_role(
                conn,
                tenant_id=principal.tenant_id,
                workspace_id=workspace_id,
                user_sub=principal.sub,
                min_role=min_role,
            )
        return principal

    return _dependency


async def _emit_denial_best_effort(
    conn: asyncpg.Connection,
    principal: Principal,
    *,
    project_iri: str,
    action: ProjectAction,
    audit_emitter: AuditEmitter,
) -> None:
    """AC-6: PLAT-AUDIT-1 write is best-effort -- a broken audit sink must
    never turn a legitimate 403 into a 500. No reusable never-raise wrapper
    exists elsewhere in this codebase (every other call site does a bare
    `await ...emit(...)`); this is the guard's own boundary.
    """
    try:
        await audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="authz_denied",
                actor_iri=principal.principal_iri,
                subject_iri=project_iri,
                payload={"action": action.value},
                engine="build",
            ),
        )
    except Exception:
        log.warning("authz_denied audit emit failed", exc_info=True)


async def enforce_project_role(
    conn: asyncpg.Connection,
    principal: Principal,
    *,
    project_iri: str,
    action: ProjectAction,
    audit_emitter: AuditEmitter = default_audit_emitter,
) -> None:
    """TASK-011 AC-1/AC-2/AC-4/AC-6: `admin`/`editor` per-project roles
    (via `pm.contributors`), overlaid by a tenant admin/owner JWT grant
    (AC-4). `domain=None` -- see `has_admin_grant`'s docstring for the M1
    `domain_iri` gap. A tenant-admin grant short-circuits before any DB
    lookup: AC-4 requires this to allow even with no contributor row.
    """
    if has_admin_grant(principal.roles, domain=None):
        return
    role = await get_contributor_role(
        conn,
        tenant_id=principal.tenant_id,
        project_iri=project_iri,
        principal_iri=principal.principal_iri,
    )
    if project_role_allows(role, action):
        return
    await _emit_denial_best_effort(
        conn, principal, project_iri=project_iri, action=action, audit_emitter=audit_emitter
    )
    raise InsufficientProjectRole(action)


def require_project_role(
    action: ProjectAction,
) -> Callable[..., Coroutine[Any, Any, Principal]]:
    """Dependency factory: `Depends(require_project_role(ProjectAction.X))`
    on a `{project_iri}`-path route. No new endpoint ships in this task --
    every future PM mutation route wires through this.
    """

    async def _dependency(
        project_iri: str,
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> Principal:
        # Catch-then-re-raise-outside-the-block, not a bare propagate: a
        # raised exception in flight when `tenant_connection`'s `async with`
        # exits rolls its whole transaction back (`conn.transaction()`,
        # ADR-010) -- including the `authz_denied` row AC-6 requires to
        # survive the very 403 it's logging.
        denial: InsufficientProjectRole | None = None
        async with tenant_connection(principal.tenant_id) as conn:
            try:
                await enforce_project_role(conn, principal, project_iri=project_iri, action=action)
            except InsufficientProjectRole as exc:
                denial = exc
        if denial is not None:
            raise denial
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
