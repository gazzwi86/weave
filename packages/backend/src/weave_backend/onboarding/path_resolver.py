"""ONB-TASK-006: role -> onboarding-path resolution (ADR-003 sibling).

Source of the role slug is `workspace_members.role` via the active-workspace
lookup, the same precedent `notifications/routers.py::_resolve_principal_role`
uses (TASK-030) -- not the JWT `roles` grant claim, which carries coarse
tenant/domain/project grants ("admin"/"owner"/"editor"), not personas.

AC-006-02 (multi-role -> choose-path prompt) is deferred: `workspace_members`
gives one role per (tenant, workspace, user); there is no multi-role source in
this codebase yet. `needs_choice` is wired below and always False in M1 --
reactivate when PLAT-IDENTITY-1 grows a real multi-role array (see
.claude/state/overnight-queue.md).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

import asyncpg

from weave_backend.auth.dependencies import Principal
from weave_backend.rbac import resolve_workspace_role
from weave_backend.tenancy.sessions import get_active_workspace

log = logging.getLogger(__name__)

RolePath = Literal["business", "technical", "compliance", "admin"]
PathVariant = Literal["default", "read_only"]

#: AC-006-01: total 10 -> 4 mapping, config data not branching code.
#: ponytail: legacy pre-TASK-030 tier roles ("admin"/"author"/"read"/
#: "publish") aren't in the 10-slug canonical set the brief scopes this
#: matrix to -- an unmapped role falls through to the same business/
#: read_only default as zero-role (AC-006-03), never an unhandled case.
ROLE_TO_PATH: dict[str, tuple[RolePath, PathVariant]] = {
    "workspace_admin": ("admin", "default"),
    "enterprise_architect": ("technical", "default"),
    "engineer": ("technical", "default"),
    "automation_author": ("technical", "default"),
    "ops_sre": ("technical", "default"),
    "data_steward": ("technical", "default"),
    "compliance_officer": ("compliance", "default"),
    "business_analyst_sme": ("business", "default"),
    "brand_content_owner": ("business", "default"),
    "viewer": ("business", "read_only"),
}

_FALLBACK: tuple[RolePath, PathVariant] = ("business", "read_only")


@dataclass(frozen=True)
class ResolvedPath:
    role_path: RolePath
    path_variant: PathVariant
    needs_choice: bool
    persist: bool


async def resolve_role_path(conn: asyncpg.Connection, principal: Principal) -> ResolvedPath:
    """AC-006-01/03/06: resolve the caller's onboarding path from their
    active-workspace role. Any failure reaching the role source (Redis for
    the active workspace, Postgres for the membership row) degrades to the
    Business read-only fallback for this call only -- never persisted, never
    blocking (AC-006-06's fail-safe law).
    """
    try:
        role = await _lookup_role(conn, principal)
    except Exception:
        log.warning("onboarding.path_resolution_unreachable", exc_info=True)
        role_path, variant = _FALLBACK
        return ResolvedPath(
            role_path=role_path, path_variant=variant, needs_choice=False, persist=False
        )

    role_path, variant = ROLE_TO_PATH.get(role, _FALLBACK) if role else _FALLBACK
    return ResolvedPath(role_path=role_path, path_variant=variant, needs_choice=False, persist=True)


async def _lookup_role(conn: asyncpg.Connection, principal: Principal) -> str | None:
    workspace_id = await get_active_workspace(principal.tenant_id, principal.sub)
    if workspace_id is None:
        return None
    return await resolve_workspace_role(
        conn, tenant_id=principal.tenant_id, workspace_id=workspace_id, user_sub=principal.sub
    )
