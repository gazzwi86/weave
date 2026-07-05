"""Law 13: request/response schemas for the billing routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SetCapRequest(BaseModel):
    scope_iri: str = Field(min_length=1)
    value_usd: float = Field(gt=0)


class SetCapResponse(BaseModel):
    scope_iri: str
    value_usd: float


class WorkspaceUsageResponse(BaseModel):
    workspace_id: str
    total_tokens: int
    total_runs: int
    total_cost_usd: float


class UsageSummaryResponse(BaseModel):
    period: str
    total_tokens: int
    total_runs: int
    total_cost_usd: float
    by_workspace: list[WorkspaceUsageResponse]
    cap_utilisation_pct: float


class SimulateAiCallRequest(BaseModel):
    """ponytail: harness-only route so the E2E/integration suites can exercise
    the pre-call gate + post-call metering without a real `ai/router.py`
    call site existing yet -- no production route wraps `route()` today.
    """

    workspace_id: str = Field(min_length=1)
    model_tier: str = Field(min_length=1)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cost_usd: float = Field(ge=0)
