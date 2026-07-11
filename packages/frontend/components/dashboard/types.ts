/** PLAT-V1-TASK-010: mirrors `schemas/dashboard.py::WidgetOut` (backend is
 * the source of truth). The fixed default dashboard only ever renders
 * `kpi_card`/`bar_chart`; TASK-012's generated widgets can be any of the 9.
 */
export type WidgetStatus = "fresh" | "stale" | "pending" | "unavailable" | "source_not_ga";

/** m2-delta.md §2: the closed 9-component generative-UI catalogue --
 * mirrors `schemas/dashboard.py::ComponentType`.
 */
export type ComponentType =
  | "kpi_card"
  | "line_area_chart"
  | "bar_chart"
  | "ranked_list"
  | "activity_feed"
  | "pie_donut"
  | "heatmap"
  | "alert_banner"
  | "table";

export interface WidgetSpec {
  component_type: ComponentType;
  title: string;
  data_source_contracts: string[];
  bindings: Record<string, unknown>;
  column_span: number;
  /** TASK-012 AC-2: set only when a named-type override wasn't
   * shape-compatible and the rule-table default was used instead. */
  override_note?: string | null;
  /** TASK-012 AC-5/AC-6: the resolver's classified data shape -- drives
   * change-viz's enabled/disabled menu options. `null`/absent for
   * hand-composed specs (fixed tiles), which change-viz has nothing to
   * offer. */
  data_shape?: string | null;
}

export interface WidgetOut {
  id: string;
  scope: "user" | "tenant_default" | "role_home";
  spec: WidgetSpec;
  position: number;
  last_result: unknown;
  fetched_at: string | null;
  status: WidgetStatus;
  pending_fields: string[];
  suggested: boolean;
}

export interface WidgetListResponse {
  widgets: WidgetOut[];
}

/** TASK-011 (m2-delta.md §3): mirrors `schemas/dashboard.py`'s SSE payload
 * models -- the `spec` event reuses `WidgetSpec` above, no wrapper needed.
 */
export interface SseDataPayload {
  rows: unknown;
  partial: boolean;
}

export interface SseDonePayload {
  token_count: number;
  widget_id: string;
}

export type SseErrorState =
  | "budget_cap"
  | "provider_503"
  | "source_not_ga"
  | "unsatisfiable"
  | "unavailable";

export interface SseErrorPayload {
  state: SseErrorState;
  reason: string;
}

export type WidgetStreamEvent =
  | { event: "spec"; data: WidgetSpec }
  | { event: "data"; data: SseDataPayload }
  | { event: "done"; data: SseDonePayload }
  | { event: "error"; data: SseErrorPayload };
