"""Law 13: request/response schemas for the widget-state routes
(PLAT-V1-TASK-010). ``WidgetSpec`` is the same shape the SSE generate
endpoint (TASK-011) will emit as its ``spec`` event (m2-delta.md §3) -- one
schema, validated the same way whichever route produced the widget.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

#: m2-delta.md §2: the finite generative-UI catalogue. Only the two component
#: types the fixed default dashboard uses are exercised by this task; the
#: rest of the closed set lands with the SSE generate endpoint (TASK-011).
ComponentType = Literal[
    "kpi_card",
    "line_area_chart",
    "bar_chart",
    "ranked_list",
    "activity_feed",
    "pie_donut",
    "heatmap",
    "alert_banner",
    "table",
]

WidgetStatus = Literal["fresh", "stale", "pending", "unavailable", "source_not_ga"]


class WidgetSpec(BaseModel):
    component_type: ComponentType
    title: str = Field(min_length=1)
    data_source_contracts: list[str] = Field(min_length=1)
    bindings: dict[str, Any]
    column_span: int = Field(ge=1, le=12)


class WidgetOut(BaseModel):
    id: str
    scope: Literal["user", "tenant_default", "role_home"]
    spec: WidgetSpec
    position: int
    last_result: Any = None
    fetched_at: datetime | None = None
    status: WidgetStatus
    pending_fields: list[str] = Field(default_factory=list)
    suggested: bool = False


class WidgetListResponse(BaseModel):
    widgets: list[WidgetOut]


class WidgetRefreshResponse(BaseModel):
    status: WidgetStatus
    fetched_at: datetime | None = None


class GenerateWidgetRequest(BaseModel):
    """Law 13: `POST /api/dashboard/widgets/generate` request body."""

    prompt: str = Field(min_length=1)


class ExamplePromptsResponse(BaseModel):
    """TASK-011 AC-8: `GET /api/dashboard/widgets/example-prompts` response."""

    prompts: list[str]
    hide_after: int


class SseDataPayload(BaseModel):
    """TASK-011 (m2-delta.md §3): the SSE `data` event payload. The `spec`
    event reuses `WidgetSpec` directly -- no wrapper needed there.
    """

    rows: Any
    partial: bool = False


class SseDonePayload(BaseModel):
    token_count: int
    widget_id: str


#: Closed set of SSE terminal error states (m2-delta.md §3/§6). `source_not_ga`
#: and `unsatisfiable` are deliberately distinct -- conflating them is a
#: review Blocker (Design Decisions table, TASK-011 brief).
SseErrorState = Literal[
    "budget_cap", "provider_503", "source_not_ga", "unsatisfiable", "unavailable"
]


class SseErrorPayload(BaseModel):
    state: SseErrorState
    reason: str
