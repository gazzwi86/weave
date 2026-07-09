"""TASK-013 (ADR-008 #4/#5, FR-008): `GET /api/projects/{project_iri}/costs`
-- read-only, so no request-body schema is needed (Law 13 N/A here).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.build.costs import CostsPayload, RollupUnavailable, get_costs
from weave_backend.db.pool import tenant_connection
from weave_backend.schemas.costs import ForecastInputsResponse, GetCostsResponse, TaskCostItem

router = APIRouter(prefix="/api/projects", tags=["costs"])


def _to_response(payload: CostsPayload) -> GetCostsResponse:
    return GetCostsResponse(
        label=payload.label,
        total_estimate_usd=payload.total_estimate_usd,
        by_task=[
            TaskCostItem(
                task_id=row.task_id,
                tokens_in=row.tokens_in,
                tokens_out=row.tokens_out,
                cost_estimate_usd=row.cost_estimate_usd,
                brief_estimate_tokens=row.brief_estimate_tokens,
            )
            for row in payload.by_task
        ],
        burn_rate_usd=payload.burn_rate_usd,
        forecast_usd=payload.forecast_usd,
        forecast_inputs=ForecastInputsResponse(
            basis=payload.forecast_inputs.basis,
            mean_actual=payload.forecast_inputs.mean_actual,
            completed_count=payload.forecast_inputs.completed_count,
            remaining_count=payload.forecast_inputs.remaining_count,
            calibration=payload.forecast_inputs.calibration,
        ),
    )


@router.get("/{project_iri}/costs", response_model=GetCostsResponse)
async def get_costs_route(
    project_iri: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> GetCostsResponse:
    """AC-1/AC-2/AC-3/AC-6: every figure is labelled `"estimated"` -- never
    presented as authoritative. AC-6: a rollup failure is a named 503, never
    a false zero-spend payload.
    """
    async with tenant_connection(principal.tenant_id) as conn:
        try:
            payload = await get_costs(conn, tenant_id=principal.tenant_id, project_iri=project_iri)
        except RollupUnavailable as exc:
            raise HTTPException(
                status_code=503, detail={"error": "costs_rollup_unavailable"}
            ) from exc
    return _to_response(payload)
