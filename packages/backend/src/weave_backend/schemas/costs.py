"""Response DTO for `GET /api/projects/{project_iri}/costs` (TASK-013,
ADR-008 #4/#5, FR-008). Wire-level shape only -- `build.costs.CostsPayload`
is the internal dataclass this is built from.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class TaskCostItem(BaseModel):
    task_id: str
    tokens_in: int
    tokens_out: int
    cost_estimate_usd: Decimal
    brief_estimate_tokens: int | None


class ForecastInputsResponse(BaseModel):
    basis: Literal["calibrated", "brief_only"]
    mean_actual: Decimal
    completed_count: int
    remaining_count: int
    calibration: Decimal


class GetCostsResponse(BaseModel):
    label: Literal["estimated"]
    total_estimate_usd: Decimal
    by_task: list[TaskCostItem]
    burn_rate_usd: Decimal
    forecast_usd: Decimal
    forecast_inputs: ForecastInputsResponse
