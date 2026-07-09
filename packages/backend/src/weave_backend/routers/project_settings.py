"""AC-2/AC-3/AC-4/AC-6 (TASK-014, build-engine EPIC-002): `.../settings`.
`GET` reads the resolved cascade via `resolve_governance` (no guard, same as
every other PM read). `PATCH` validates via `validate_model_tier`/
`validate_cap_against_parent` (both company-scope reads, ADR-013) then
attempts to persist at project scope -- which `settings/scope.py`'s IRI
grammar cannot parse for a Build project IRI today (ADR-013 extended from
reads to writes: `set_setting` calls the same `scope_of` that raises
`InvalidScopeIri`). Fail-safe/under-grant: refuse with 503 rather than
silently writing the change at company scope, which would let anyone
holding only a per-project `admin` role (not tenant-wide) move a setting
that affects every other project in the tenant -- a privilege escalation,
not a convenience. Validation still runs and still 422s on bad input before
that wall is hit, so AC-3/AC-4 hold; only the "persist a valid change" path
is blocked, tracked as a known TASK-014 limitation pending an ADR-013 fix.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.costs import BUDGET_CAP_KEY
from weave_backend.db.pool import tenant_connection
from weave_backend.projects.governance import (
    MODEL_TIER_KEY,
    CapLooserThanParent,
    GovernanceSnapshot,
    InvalidModelTier,
    resolve_governance,
    validate_cap_against_parent,
    validate_model_tier,
)
from weave_backend.rbac import ProjectAction, require_project_role
from weave_backend.schemas.project_settings import (
    ProjectSettingsResponse,
    UpdateProjectSettingsRequest,
)
from weave_backend.settings.resolver import set_setting
from weave_backend.settings.scope import InvalidScopeIri

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_response(snapshot: GovernanceSnapshot) -> ProjectSettingsResponse:
    return ProjectSettingsResponse(
        model_tier=snapshot.model_tier,
        model_tier_source=snapshot.model_tier_source,
        cost_cap_usd=snapshot.cap_usd,
        cost_cap_source=snapshot.cap_source,
    )


@router.get("/{project_iri}/settings", response_model=ProjectSettingsResponse)
async def get_project_settings_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ProjectSettingsResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        snapshot = await resolve_governance(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    return _to_response(snapshot)


async def _validate(
    conn: asyncpg.Connection, *, tenant_id: str, body: UpdateProjectSettingsRequest
) -> None:
    if body.model_tier is not None:
        try:
            validate_model_tier(body.model_tier)
        except InvalidModelTier as exc:
            raise HTTPException(
                status_code=422, detail={"error": "invalid_model_tier", "tier": exc.tier}
            ) from exc
    if body.cost_cap_usd is not None:
        try:
            await validate_cap_against_parent(
                conn, tenant_id=tenant_id, value_usd=body.cost_cap_usd
            )
        except CapLooserThanParent as exc:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "cap_looser_than_parent",
                    "level": exc.level,
                    "parent_cap_usd": exc.parent_cap_usd,
                },
            ) from exc


@router.patch("/{project_iri}/settings", response_model=ProjectSettingsResponse)
async def update_project_settings_route(
    project_iri: str,
    body: UpdateProjectSettingsRequest,
    principal: Annotated[Principal, Depends(require_project_role(ProjectAction.SETTINGS))],
) -> ProjectSettingsResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        await _validate(conn, tenant_id=principal.tenant_id, body=body)
        try:
            if body.model_tier is not None:
                await set_setting(
                    conn,
                    tenant_id=principal.tenant_id,
                    key=MODEL_TIER_KEY,
                    scope_iri=project_iri,
                    value=body.model_tier,
                )
            if body.cost_cap_usd is not None:
                await set_setting(
                    conn,
                    tenant_id=principal.tenant_id,
                    key=BUDGET_CAP_KEY,
                    scope_iri=project_iri,
                    value=body.cost_cap_usd,
                )
        except InvalidScopeIri as exc:
            # ADR-013: project-scope writes are unreachable until Build
            # project IRIs carry a domain segment -- see module docstring.
            raise HTTPException(
                status_code=503, detail={"error": "project_scope_settings_unavailable"}
            ) from exc
        snapshot = await resolve_governance(
            conn, tenant_id=principal.tenant_id, project_iri=project_iri
        )
    return _to_response(snapshot)
