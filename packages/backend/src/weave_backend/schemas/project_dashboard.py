"""BE-V1-TASK-019: wire-level DTOs for `GET
/api/projects/{project_iri}/dashboard/{tile}`. One typed model per tile --
no aggregate mega-endpoint (aggregation would recouple tile failure modes,
per the task's Design Decisions table).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from weave_backend.schemas.costs import ForecastInputsResponse

TILE_NAMES: tuple[str, ...] = ("demo", "budget", "forecast", "tasks", "blockers", "ribbon")


class DemoTile(BaseModel):
    """AC-3: `last_run_status` drives the failure banner; `output_location_ref`
    is only ever the *last successful* URL -- never overwritten on failure.
    """

    output_location_ref: str | None
    last_run_status: Literal["passed", "failed"] | None


class BudgetTile(BaseModel):
    """AC-4: `cap_usd`/`level` are `None` when no cap is configured anywhere
    in the cascade (fail-open, same convention as `build/costs.py`).
    """

    label: Literal["estimated"]
    total_estimate_usd: float
    cap_usd: float | None
    level: str | None


class ForecastTile(BaseModel):
    label: Literal["estimated"]
    forecast_usd: float
    forecast_inputs: ForecastInputsResponse


class TaskCountsTile(BaseModel):
    ready: int
    blocked: int
    done: int
    revision: int


class BlockerItem(BaseModel):
    task_id: str
    reason: str


class BlockersTile(BaseModel):
    items: list[BlockerItem]


class RibbonRun(BaseModel):
    run_id: str
    branch: str
    commit_sha: str
    created_at: datetime
    repo_url: str | None


class RibbonTile(BaseModel):
    runs: list[RibbonRun]
