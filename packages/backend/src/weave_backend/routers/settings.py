"""AC-4/AC-5: `GET`/`PUT /api/settings/{key}`, cache-then-resolve."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

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
from weave_backend.tenancy.sessions import get_redis

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings/{key}", response_model=ResolvedSettingResponse)
async def get_setting_route(
    key: str,
    context: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> ResolvedSettingResponse:
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

    await invalidate_tenant(get_redis(), tenant_id=principal.tenant_id)
    return SetSettingResponse(key=key, scope_iri=body.scope_iri, value=body.value)
