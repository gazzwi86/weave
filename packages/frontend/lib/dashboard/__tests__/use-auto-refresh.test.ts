import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetOut } from "@/components/dashboard/types";

import { AUTO_REFRESH_TICK_MS, useAutoRefresh, widgetsDueForRefresh } from "../use-auto-refresh";

function widget(overrides: Partial<WidgetOut> = {}): WidgetOut {
  return {
    id: "w-1",
    scope: "user",
    spec: {
      component_type: "kpi_card",
      title: "x",
      data_source_contracts: ["CE-METRICS-1"],
      bindings: { field: "x" },
      column_span: 3,
    },
    position: 0,
    last_result: 1,
    fetched_at: new Date().toISOString(),
    status: "fresh",
    pending_fields: [],
    suggested: false,
    refresh_interval_s: 300,
    ...overrides,
  };
}

describe("widgetsDueForRefresh", () => {
  it("is not due when fetched recently within the interval", () => {
    const now = Date.now();
    const w = widget({ fetched_at: new Date(now - 10_000).toISOString(), refresh_interval_s: 300 });
    expect(widgetsDueForRefresh([w], now)).toEqual([]);
  });

  it("is due once past the refresh interval", () => {
    const now = Date.now();
    const w = widget({ fetched_at: new Date(now - 301_000).toISOString(), refresh_interval_s: 300 });
    expect(widgetsDueForRefresh([w], now)).toEqual(["w-1"]);
  });

  it("is due when never fetched", () => {
    const now = Date.now();
    const w = widget({ fetched_at: null });
    expect(widgetsDueForRefresh([w], now)).toEqual(["w-1"]);
  });
});

describe("useAutoRefresh (AC-3): timer visibility-gated", () => {
  let visibilityState: DocumentVisibilityState = "visible";

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not fetch on tick while the tab is hidden", () => {
    visibilityState = "hidden";
    const overdue = widget({ fetched_at: new Date(Date.now() - 301_000).toISOString() });
    const fetchRefresh = vi.fn().mockResolvedValue({ status: "fresh", fetched_at: null });
    const onRefreshed = vi.fn();

    renderHook(() => useAutoRefresh([overdue], fetchRefresh, onRefreshed));
    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_TICK_MS);
    });

    expect(fetchRefresh).not.toHaveBeenCalled();
  });

  it("refreshes immediately on becoming visible when overdue", () => {
    visibilityState = "hidden";
    const overdue = widget({ fetched_at: new Date(Date.now() - 301_000).toISOString() });
    const fetchRefresh = vi.fn().mockResolvedValue({ status: "fresh", fetched_at: null });
    const onRefreshed = vi.fn();

    renderHook(() => useAutoRefresh([overdue], fetchRefresh, onRefreshed));

    visibilityState = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetchRefresh).toHaveBeenCalledWith("w-1");
  });

  it("refreshes an overdue widget on a normal tick while visible", () => {
    const overdue = widget({ fetched_at: new Date(Date.now() - 301_000).toISOString() });
    const fetchRefresh = vi.fn().mockResolvedValue({ status: "fresh", fetched_at: null });
    const onRefreshed = vi.fn();

    renderHook(() => useAutoRefresh([overdue], fetchRefresh, onRefreshed));
    act(() => {
      vi.advanceTimersByTime(AUTO_REFRESH_TICK_MS);
    });

    expect(fetchRefresh).toHaveBeenCalledWith("w-1");
  });
});
