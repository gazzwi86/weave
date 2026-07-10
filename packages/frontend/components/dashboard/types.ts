/** PLAT-V1-TASK-010: mirrors `schemas/dashboard.py::WidgetOut` (backend is
 * the source of truth). Only `kpi_card`/`bar_chart` are exercised here --
 * the fixed default dashboard's only two component types.
 */
export type WidgetStatus = "fresh" | "stale" | "pending" | "unavailable" | "source_not_ga";

export interface WidgetSpec {
  component_type: "kpi_card" | "bar_chart" | string;
  title: string;
  data_source_contracts: string[];
  bindings: Record<string, unknown>;
  column_span: number;
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
