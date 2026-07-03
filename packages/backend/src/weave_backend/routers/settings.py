"""AC-4/AC-5: `GET`/`PUT /api/settings/{key}`, cache-then-resolve."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.audit.emitter import AuditEvent, default_audit_emitter
from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.settings import (
    ResolvedSettingResponse,
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
from weave_backend.settings.scope import InvalidScopeIri, tenant_of
from weave_backend.tenancy.sessions import get_redis

router = APIRouter(prefix="/api", tags=["settings"])


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


@router.get("/settings/{key}", response_model=ResolvedSettingResponse)
async def get_setting_route(
    key: str,
    context: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ResolvedSettingResponse:
    _require_own_tenant_scope(principal, context)
    redis = get_redis()
    cached = await get_cached(redis, tenant_id=principal.tenant_id, key=key, context_iri=context)
    if cached is not None:
        return ResolvedSettingResponse(**cached.__dict__)

    async with tenant_connection(principal.tenant_id) as conn:
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
