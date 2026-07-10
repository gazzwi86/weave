"""Response DTO for `GET /api/projects/{project_iri}/costs` (TASK-013,
ADR-008 #4/#5, FR-008). Wire-level shape only -- `build.costs.CostsPayload`
is the internal dataclass this is built from.

Money fields are `float`, not `Decimal`: FastAPI/Pydantic serialise
`Decimal` as a JSON string (`"1.500000"`), inconsistent with
`schemas/billing.py`'s established `float` convention for USD wire fields.
Internal computation (`build/costs.py`) stays `Decimal` for precision;
only the wire boundary here narrows to `float`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class TaskCostItem(BaseModel):
    task_id: str
    tokens_in: int
    tokens_out: int
    cost_estimate_usd: float
    brief_estimate_tokens: int | None


class ForecastInputsResponse(BaseModel):
    basis: Literal["calibrated", "brief_only"]
    mean_actual: float
    completed_count: int
    remaining_count: int
    calibration: float


class GetCostsResponse(BaseModel):
    label: Literal["estimated"]
    total_estimate_usd: float
    by_task: list[TaskCostItem]
    burn_rate_usd: float
    forecast_usd: float
    forecast_inputs: ForecastInputsResponse
