import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WidgetOut } from "../types";
import { WidgetTile } from "../widget-tile";

function kpiWidget(overrides: Partial<WidgetOut> = {}): WidgetOut {
  return {
    id: "w-1",
    scope: "tenant_default",
    spec: {
      component_type: "kpi_card",
      title: "Entities in model",
      data_source_contracts: ["CE-METRICS-1"],
      bindings: { field: "entity_count_by_kind", aggregate: "sum" },
      column_span: 3,
    },
    position: 0,
    last_result: 42,
    fetched_at: "2026-07-10T12:00:00Z",
    status: "fresh",
    pending_fields: [],
    suggested: false,
    refresh_interval_s: 300,
    ...overrides,
  };
}

function barWidget(overrides: Partial<WidgetOut> = {}): WidgetOut {
  return {
    id: "w-2",
    scope: "tenant_default",
    spec: {
      component_type: "bar_chart",
      title: "Entities by kind",
      data_source_contracts: ["CE-METRICS-1"],
      bindings: { field: "entity_count_by_kind" },
      column_span: 6,
    },
    position: 1,
    last_result: { Process: 4, Goal: 2 },
    fetched_at: "2026-07-10T12:00:00Z",
    status: "fresh",
    pending_fields: [],
    suggested: false,
    refresh_interval_s: 300,
    ...overrides,
  };
}

describe("WidgetTile", () => {
  it("AC-3: renders a kpi_card's title and numeric value", () => {
    render(<WidgetTile widget={kpiWidget()} />);

    expect(screen.getByText("Entities in model")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("AC-3: renders a bar_chart's title and one bar per category", () => {
    render(<WidgetTile widget={barWidget()} />);

    expect(screen.getByText("Entities by kind")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Goal")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("AC-4: renders 'Data unavailable' for status=unavailable, no crash on null last_result", () => {
    render(<WidgetTile widget={kpiWidget({ status: "unavailable", last_result: null })} />);

    expect(screen.getByText(/data unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("AC-5: renders 'Counts pending', never a 0, for status=pending", () => {
    render(
      <WidgetTile widget={kpiWidget({ status: "pending", last_result: { pending: true } })} />
    );

    expect(screen.getByText(/counts pending/i)).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("AC-7: status=stale still shows the retained prior value plus a Stale badge", () => {
    render(<WidgetTile widget={kpiWidget({ status: "stale", last_result: 42 })} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  it("shows the CE-METRICS-1 data-source footer on every tile", () => {
    render(<WidgetTile widget={kpiWidget()} />);

    expect(screen.getByText(/CE-METRICS-1/)).toBeInTheDocument();
  });
});
