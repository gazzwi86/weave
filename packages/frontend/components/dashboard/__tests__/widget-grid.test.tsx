import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WidgetOut } from "../types";
import { WidgetGrid } from "../widget-grid";

function widget(
  position: number,
  columnSpan: number,
  overrides: Partial<WidgetOut> = {}
): WidgetOut {
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
    refresh_interval_s: 300,
    ...overrides,
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

describe("WidgetGrid: reorder (AC-5/AC-6/AC-7)", () => {
  it("keyboard move-down/up calls onReorder with the full user-scope order", () => {
    const onReorder = vi.fn();
    const widgets = [
      widget(0, 3, { id: "w-a", scope: "user" }),
      widget(1, 3, { id: "w-b", scope: "user" }),
    ];
    render(<WidgetGrid widgets={widgets} onReorder={onReorder} />);

    screen.getByRole("button", { name: /move tile 0 down/i }).click();

    expect(onReorder).toHaveBeenCalledWith(["w-b", "w-a"]);
  });

  it("does not offer move/pin/unpin controls for tenant_default tiles", () => {
    const widgets = [widget(0, 3, { scope: "tenant_default" })];
    render(<WidgetGrid widgets={widgets} onReorder={vi.fn()} onPin={vi.fn()} onUnpin={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /move/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pin/i })).not.toBeInTheDocument();
  });

  it("offers an Unpin control for user-scope tiles when onUnpin is given", () => {
    const widgets = [widget(0, 3, { id: "w-a", scope: "user" })];
    render(<WidgetGrid widgets={widgets} onUnpin={vi.fn()} />);

    expect(screen.getByRole("button", { name: /unpin tile 0/i })).toBeInTheDocument();
  });

  it("offers a Pin control only for suggested user-scope tiles", () => {
    const widgets = [widget(0, 3, { id: "w-a", scope: "user", suggested: true })];
    render(<WidgetGrid widgets={widgets} onPin={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^pin tile 0$/i })).toBeInTheDocument();
  });
});
