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
    #: TASK-012 AC-2: set only when a prompt's named-type override wasn't
    #: shape-compatible and the rule-table default was used instead.
    override_note: str | None = None
    #: TASK-012 AC-5/AC-6: the resolver's classified data shape, carried
    #: through so the client change-viz menu knows which of the 9 components
    #: are compatible without re-deriving it from `component_type` (several
    #: components appear in more than one shape's compat list, so that
    #: reverse-lookup would be ambiguous). `None` for hand-composed specs
    #: (fixed tenant-default tiles, the keyword-table latency fallback) --
    #: change-viz has nothing to offer those.
    data_shape: str | None = None


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


class ComponentTypePatch(BaseModel):
    component_type: ComponentType


class UpdateWidgetSpecRequest(BaseModel):
    """Law 13: `PATCH /api/dashboard/widgets/{id}` request body (TASK-012,
    m2-delta.md §5) -- change-visualisation persistence. Component-type-only
    patch; extend if a second patchable field shows up.
    """

    spec: ComponentTypePatch


class OrderPatchRequest(BaseModel):
    """Law 13: `PATCH /api/dashboard/widgets/order` request body (TASK-014
    AC-5) -- one batch reorder, one audit entry."""

    ids_in_order: list[str] = Field(min_length=1)


class OrderPatchResponse(BaseModel):
    updated: int


class RestoreWidgetRequest(BaseModel):
    """Law 13: `POST /api/dashboard/widgets/{id}/restore` request body
    (TASK-013 AC-4)."""

    seq: int = Field(ge=1)


class RestoreWidgetResponse(BaseModel):
    spec: WidgetSpec
    status: WidgetStatus
    fetched_at: datetime | None = None


class HistoryStepOut(BaseModel):
    """TASK-013 AC-4: specs are deliberately omitted from the list --
    fetched only on restore (API Contracts)."""

    seq: int
    prompt: str
    created_at: datetime


class HistoryResponse(BaseModel):
    steps: list[HistoryStepOut]
