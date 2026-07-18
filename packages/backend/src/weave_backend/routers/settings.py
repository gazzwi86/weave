"""AC-4/AC-5: `GET`/`PUT /api/settings/{key}`, cache-then-resolve."""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from weave_backend.ai.config import MODEL_ROUTING_TABLE
from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.model_routing import ALLOWED_MODELS
from weave_backend.db.pool import tenant_connection
from weave_backend.rbac import enforce_workspace_role, require_tenant_admin
from weave_backend.schemas.settings import (
    ModelsSettingsResponse,
    ModelTierInfo,
    ResolvedSettingResponse,
    SetModelSettingsRequest,
    SetSettingRequest,
    SetSettingResponse,
)
from weave_backend.settings.cache import get_cached, invalidate_tenant, set_cached
from weave_backend.settings.resolver import (
    LooserOverrideRejected,
    SettingNotFound,
    resolve_setting,
    set_setting,
)
from weave_backend.settings.scope import InvalidScopeIri, company_iri, tenant_of, workspace_of
from weave_backend.tenancy.sessions import get_redis

router = APIRouter(prefix="/api", tags=["settings"])

#: G13 (docs/design/remediation-2-api-gaps.md): company-scoped override key
#: per tier, resolved through the same PLAT-SETTINGS-1 cascade as every
#: other setting -- `MODEL_ROUTING_TABLE[tier]` is the fallback default when
#: no override was ever written.
_MODEL_TIER_SETTING_KEY = "platform.models.{tier}.selected"


async def _load_model_tiers(
    conn: asyncpg.Connection, tenant_id: str
) -> dict[str, ModelTierInfo]:
    allowed = sorted(ALLOWED_MODELS)
    tiers: dict[str, ModelTierInfo] = {}
    for tier, default_model in MODEL_ROUTING_TABLE.items():
        try:
            resolved = await resolve_setting(
                conn,
                tenant_id=tenant_id,
                key=_MODEL_TIER_SETTING_KEY.format(tier=tier),
                context_iri=company_iri(tenant_id),
            )
            selected = resolved.value
        except SettingNotFound:
            selected = default_model
        tiers[tier] = ModelTierInfo(selected=selected, allowed=allowed)
    return tiers


@router.get("/settings/models", response_model=ModelsSettingsResponse)
async def get_model_settings_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ModelsSettingsResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        tiers = await _load_model_tiers(conn, principal.tenant_id)
    return ModelsSettingsResponse(tiers=tiers)


@router.put("/settings/models", response_model=ModelsSettingsResponse)
async def set_model_settings_route(
    body: SetModelSettingsRequest,
    principal: Annotated[Principal, Depends(require_tenant_admin)],
) -> ModelsSettingsResponse:
    if body.tier not in MODEL_ROUTING_TABLE:
        raise HTTPException(status_code=422, detail={"error": "unknown_tier", "tier": body.tier})
    if body.model not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=422, detail={"error": "model_not_allowed", "model": body.model}
        )
    async with tenant_connection(principal.tenant_id) as conn:
        await set_setting(
            conn,
            tenant_id=principal.tenant_id,
            key=_MODEL_TIER_SETTING_KEY.format(tier=body.tier),
            scope_iri=company_iri(principal.tenant_id),
            value=body.model,
        )
        tiers = await _load_model_tiers(conn, principal.tenant_id)
    return ModelsSettingsResponse(tiers=tiers)


def _require_own_tenant_scope(principal: Principal, scope_iri: str) -> None:
    """PR #11 finding 4: reject any scope IRI whose tenant segment isn't
    the caller's own -- previously any tenant could read/write another
    tenant's settings row by supplying its scope_iri/context directly.
    """
    try:
        iri_tenant_id = tenant_of(scope_iri)
    except InvalidScopeIri as exc:
        raise HTTPException(status_code=400, detail={"error": "invalid_scope_iri"}) from exc
    if iri_tenant_id != principal.tenant_id:
        raise HTTPException(status_code=403, detail={"error": "tenant_mismatch"})


async def _require_workspace_role_for_scope(
    conn: asyncpg.Connection, principal: Principal, scope_iri: str, min_role: str
) -> None:
    """QA FAIL remediation (AC-3): company/domain scope has no workspace
    segment (`workspace_of` returns `None`) -- there's no membership row to
    check there, so those scopes stay tenant-match-only, matching existing
    precedent (company-scope settings are usable by any tenant member).
    Workspace/project scope must additionally prove active membership at
    `min_role`, rejecting a non-member (no row at all) the same as an
    insufficient one. Takes an already-open `conn` (PR #12 review finding 3)
    -- the caller's own `tenant_connection` block, so a settings request
    never acquires two pool connections.
    """
    workspace_id = workspace_of(scope_iri)
    if workspace_id is None:
        return
    await enforce_workspace_role(
        conn,
        tenant_id=principal.tenant_id,
        workspace_id=workspace_id,
        user_sub=principal.sub,
        min_role=min_role,
    )


@router.get("/settings/{key}", response_model=ResolvedSettingResponse)
async def get_setting_route(
    key: str,
    context: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ResolvedSettingResponse:
    _require_own_tenant_scope(principal, context)
    redis = get_redis()
    async with tenant_connection(principal.tenant_id) as conn:
        await _require_workspace_role_for_scope(conn, principal, context, min_role="read")
        cached = await get_cached(
            redis, tenant_id=principal.tenant_id, key=key, context_iri=context
        )
        if cached is not None:
            return ResolvedSettingResponse(**cached.__dict__)

        try:
            resolved = await resolve_setting(
                conn, tenant_id=principal.tenant_id, key=key, context_iri=context
            )
        except SettingNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "setting_not_found"}) from exc

    await set_cached(
        redis, tenant_id=principal.tenant_id, key=key, context_iri=context, resolved=resolved
    )
    return ResolvedSettingResponse(**resolved.__dict__)


@router.put("/settings/{key}", response_model=SetSettingResponse)
async def set_setting_route(
    key: str,
    body: SetSettingRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SetSettingResponse:
    _require_own_tenant_scope(principal, body.scope_iri)
    async with tenant_connection(principal.tenant_id) as conn:
        # ADR-007: "author" ceiling, not "admin" -- a settings write is a
        # config change, not a membership/access change (that's what "admin"
        # gates on invite/revoke). Any contributor at "author" or above may
        # write settings in a workspace/project they belong to.
        await _require_workspace_role_for_scope(conn, principal, body.scope_iri, min_role="author")
        try:
            await set_setting(
                conn,
                tenant_id=principal.tenant_id,
                key=key,
                scope_iri=body.scope_iri,
                value=body.value,
            )
        except LooserOverrideRejected as exc:
            raise HTTPException(
                status_code=422,
                detail={"error": "looser_override_rejected", "tighter_scope": exc.tighter_scope},
            ) from exc
        await default_audit_emitter.emit(
            conn,
            AuditEvent(
                tenant_id=principal.tenant_id,
                event_type="setting.changed",
                actor_iri=principal.principal_iri,
                subject_iri=body.scope_iri,
                payload={"key": key, "value": body.value},
            ),
        )

    await invalidate_tenant(get_redis(), tenant_id=principal.tenant_id)
    return SetSettingResponse(key=key, scope_iri=body.scope_iri, value=body.value)
