import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function activityFeedWidget(overrides: Partial<WidgetOut> = {}): WidgetOut {
  return {
    id: "w-3",
    scope: "tenant_default",
    spec: {
      component_type: "activity_feed",
      title: "Recent edits",
      data_source_contracts: ["CE-EVENT-1", "CE-READ-1"],
      bindings: { category: "collaboration-activity" },
      column_span: 6,
    },
    position: 2,
    last_result: {
      rows: [
        {
          actor: "alice@acme.com",
          entity_iri: "urn:acme:process:onboarding",
          label: "Onboarding process",
          href: "/resource/urn:acme:process:onboarding",
          version_iri: "urn:acme:version:7",
          created_at: "2026-07-10T11:00:00Z",
        },
        {
          actor: "bob@acme.com",
          entity_iri: "urn:acme:goal:grow",
          label: "Grow revenue",
          href: "/resource/urn:acme:goal:grow",
          version_iri: null,
          created_at: "2026-07-10T10:00:00Z",
        },
      ],
    },
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

  it("AC-2: activity_feed renders one row per edit with actor, entity label+id, and a deep link", () => {
    render(<WidgetTile widget={activityFeedWidget()} />);

    expect(screen.getByText("alice@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Onboarding process")).toBeInTheDocument();
    expect(screen.getByText("urn:acme:process:onboarding")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /onboarding process/i });
    expect(link).toHaveAttribute("href", "/resource/urn:acme:process:onboarding");
  });

  it("AC-2: activity_feed marks a null version_iri row as Draft via icon+text, not colour alone", () => {
    render(<WidgetTile widget={activityFeedWidget()} />);

    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it("activity_feed footer cites both CE-EVENT-1 and CE-READ-1 contracts", () => {
    render(<WidgetTile widget={activityFeedWidget()} />);

    expect(screen.getByText(/CE-EVENT-1/)).toBeInTheDocument();
    expect(screen.getByText(/CE-READ-1/)).toBeInTheDocument();
  });

  it("AC-3: 410 re-baseline notice renders as a named-reason tile, not a blank feed", () => {
    render(
      <WidgetTile
        widget={activityFeedWidget({
          last_result: { rows: [], truncated: true, notice: "Feed re-baselined" },
        })}
      />
    );

    expect(screen.getByText(/re-baselined/i)).toBeInTheDocument();
  });

  it("H1b: truncates a long title and keeps the full text available via a title attribute", () => {
    render(<WidgetTile widget={kpiWidget()} />);

    const heading = screen.getByRole("heading", { name: "Entities in model" });
    expect(heading).toHaveClass("truncate");
    expect(heading).toHaveAttribute("title", "Entities in model");
  });

  it("H1: exactly one of Pin/Unpin renders on a suggested (not-yet-pinned) user widget", () => {
    render(
      <WidgetTile
        widget={kpiWidget({ scope: "user", suggested: true })}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /^pin/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^unpin/i })).not.toBeInTheDocument();
  });

  it("H1: exactly one of Pin/Unpin renders on an already-pinned user widget", () => {
    render(
      <WidgetTile
        widget={kpiWidget({ scope: "user", suggested: false })}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /^unpin/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^pin/i })).not.toBeInTheDocument();
  });

  it("H2: a KPI URN with a :vX.Y.Z tail displays just the version, full URN in a title attribute", () => {
    const urn = "urn:weave:tenant:acme-corp:ws:2b00d676-1234-4a1b-9c3d-abcdef012345:v0.1.6";
    render(
      <WidgetTile
        widget={kpiWidget({
          spec: { ...kpiWidget().spec, title: "Latest published version" },
          last_result: urn,
        })}
      />
    );

    expect(screen.getByText("v0.1.6")).toBeInTheDocument();
    expect(screen.queryByText(urn)).not.toBeInTheDocument();
    expect(screen.getByText("v0.1.6")).toHaveAttribute("title", urn);
  });

  it("H3: the stale badge shows the single word 'Stale' (no wrapping text) with a tooltip", () => {
    render(<WidgetTile widget={kpiWidget({ status: "stale", last_result: 42 })} />);

    const badge = screen.getByText("Stale");
    expect(badge).toHaveClass("whitespace-nowrap");
    expect(badge).toHaveAttribute("title");
    expect(badge.getAttribute("title")).toMatch(/last updated/i);
  });
});
