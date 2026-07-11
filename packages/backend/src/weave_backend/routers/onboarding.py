"""ONB-TASK-001: `/api/onboarding/*` -- per-(tenant, user) onboarding
progress state (path, tour resume points, dismissals, checklist, exercise
completions, activations). Same authz shape as notifications: a principal
only ever sees/mutates rows keyed by their own `user_id` -- no route accepts
a client-supplied user id, so `get_current_principal` + RLS is the whole
authz story (AC-001-03: "reject a foreign user id" has no input vector to
build, since one never arrives).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.db.pool import tenant_connection
from weave_backend.onboarding import store
from weave_backend.schemas.onboarding import (
    BulkDeletedResponse,
    DeletedResponse,
    DismissalKindIn,
    OnboardingStateOut,
    OnboardingStatePatchRequest,
    SavedResponse,
    TourProgressRequest,
)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _to_out(record: store.OnboardingStateRecord) -> OnboardingStateOut:
    return OnboardingStateOut(**record.model_dump())


@router.get("/state", response_model=OnboardingStateOut)
async def get_state_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    async with tenant_connection(principal.tenant_id) as conn:
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    return _to_out(record)


@router.patch("/state", response_model=OnboardingStateOut)
async def patch_state_route(
    body: OnboardingStatePatchRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> OnboardingStateOut:
    patch = store.StatePatch(**body.model_dump())
    async with tenant_connection(principal.tenant_id) as conn:
        await store.patch_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri, patch=patch
        )
        record = await store.get_state(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    return _to_out(record)


@router.put("/tours/{tour_id}/progress", response_model=SavedResponse)
async def upsert_tour_progress_route(
    tour_id: str,
    body: TourProgressRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SavedResponse:
    patch = store.TourProgressPatch(**body.model_dump())
    async with tenant_connection(principal.tenant_id) as conn:
        await store.upsert_tour_progress(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            tour_id=tour_id,
            patch=patch,
        )
    return SavedResponse(saved=True)


@router.put("/dismissals/{kind}/{ref_id}", response_model=SavedResponse)
async def upsert_dismissal_route(
    kind: DismissalKindIn,
    ref_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SavedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        await store.upsert_dismissal(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            kind=kind,
            ref_id=ref_id,
        )
    return SavedResponse(saved=True)


@router.delete("/dismissals/beacon", response_model=BulkDeletedResponse)
async def delete_beacon_dismissals_route(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> BulkDeletedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        count = await store.delete_beacon_dismissals(
            conn, tenant_id=principal.tenant_id, user_id=principal.principal_iri
        )
    return BulkDeletedResponse(deleted_count=count)


@router.delete("/dismissals/{kind}/{ref_id}", response_model=DeletedResponse)
async def delete_dismissal_route(
    kind: DismissalKindIn,
    ref_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> DeletedResponse:
    async with tenant_connection(principal.tenant_id) as conn:
        found = await store.delete_dismissal(
            conn,
            tenant_id=principal.tenant_id,
            user_id=principal.principal_iri,
            kind=kind,
            ref_id=ref_id,
        )
    return DeletedResponse(deleted=found)
