"""AC-1: `POST /api/specs/{spec_id}/transition` (BE-TASK-005, build-engine
EPIC-006).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.lifecycle import InvalidTransition, SpecTransition, transition_spec
from weave_backend.build.store import SpecNotFound
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.specs import SpecTransitionRequest, SpecTransitionResponse

router = APIRouter(prefix="/api/specs", tags=["specs"])


@router.post("/{spec_id}/transition", response_model=SpecTransitionResponse)
async def transition_spec_route(
    spec_id: str,
    body: SpecTransitionRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> SpecTransitionResponse:
    transition = SpecTransition(
        tenant_id=principal.tenant_id,
        spec_id=spec_id,
        requested_state=body.requested_state,
        actor_iri=principal.principal_iri,
    )
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            updated = await transition_spec(conn, transition)
        except SpecNotFound as exc:
            raise HTTPException(status_code=404, detail={"error": "not_found"}) from exc
        except InvalidTransition as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "invalid_transition",
                    "current": exc.current,
                    "requested": exc.requested,
                },
            ) from exc

    return SpecTransitionResponse(spec_id=spec_id, status=updated.status)
