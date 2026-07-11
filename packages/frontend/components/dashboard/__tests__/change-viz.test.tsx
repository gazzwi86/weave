import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChangeViz } from "../change-viz";
import type { WidgetSpec } from "../types";

function barChartSpec(overrides: Partial<WidgetSpec> = {}): WidgetSpec {
  return {
    component_type: "bar_chart",
    title: "Entities by kind",
    data_source_contracts: ["CE-METRICS-1"],
    bindings: { field: "entity_count_by_kind" },
    column_span: 6,
    data_shape: "categorical",
    ...overrides,
  };
}

describe("ChangeViz", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-5: switching type is a pure client re-render -- no fetch/EventSource
  // when the widget isn't pinned (no widgetId).
  it("test_change_viz_no_refetch: never calls fetch/EventSource when unpinned", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const eventSourceSpy = vi.fn();
    vi.stubGlobal("EventSource", eventSourceSpy);

    const onChange = vi.fn();
    render(<ChangeViz spec={barChartSpec()} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("change-viz-select"), { target: { value: "table" } });

    expect(onChange).toHaveBeenCalledWith("table");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceSpy).not.toHaveBeenCalled();
  });

  it("test_change_viz_disables_incompatible: scalar-shape widget disables heatmap with a reason", () => {
    render(
      <ChangeViz
        spec={barChartSpec({ component_type: "kpi_card", data_shape: "scalar" })}
        onChange={vi.fn()}
      />
    );

    const heatmapOption = screen.getByRole("option", { name: /heatmap/i });
    expect(heatmapOption).toBeDisabled();
    expect(heatmapOption).toHaveAttribute("title", expect.stringContaining("incompatible with scalar data"));

    const kpiOption = screen.getByRole("option", { name: "kpi_card" });
    expect(kpiOption).not.toBeDisabled();
  });

  it("PATCHes the pinned widget's spec when widgetId is present", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const onChange = vi.fn();

    render(<ChangeViz spec={barChartSpec()} widgetId="w-9" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("change-viz-select"), { target: { value: "table" } });

    expect(onChange).toHaveBeenCalledWith("table");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/dashboard/widgets/w-9",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ spec: { component_type: "table" } }),
      })
    );
  });

  it("ignores a select of the already-current type (no-op)", () => {
    const onChange = vi.fn();
    render(<ChangeViz spec={barChartSpec()} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("change-viz-select"), { target: { value: "bar_chart" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
