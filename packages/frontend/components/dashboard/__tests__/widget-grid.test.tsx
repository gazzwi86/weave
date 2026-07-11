import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WidgetOut } from "../types";
import { WidgetGrid } from "../widget-grid";

function widget(position: number, columnSpan: number): WidgetOut {
  return {
    id: `w-${position}`,
    scope: "tenant_default",
    spec: {
      component_type: "kpi_card",
      title: `Tile ${position}`,
      data_source_contracts: ["CE-METRICS-1"],
      bindings: { field: "x" },
      column_span: columnSpan,
    },
    position,
    last_result: 1,
    fetched_at: null,
    status: "fresh",
    pending_fields: [],
    suggested: false,
  };
}

describe("WidgetGrid", () => {
  it("AC-3: renders one tile per widget, in position order", () => {
    const widgets = [widget(1, 3), widget(0, 6)];
    render(<WidgetGrid widgets={widgets} />);

    const titles = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    expect(titles).toEqual(["Tile 0", "Tile 1"]);
  });

  it("gives each tile a grid-column span matching its spec.column_span", () => {
    render(<WidgetGrid widgets={[widget(0, 3)]} />);

    const tile = screen.getByTestId("widget-tile-w-0");
    expect(tile.style.gridColumn).toContain("3");
  });
});
