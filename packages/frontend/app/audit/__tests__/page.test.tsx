import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuditDashboardPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function summaryFor(period: string) {
  return {
    chain_status: "valid",
    entries_checked: 42,
    first_broken_seq: null,
    by_event_category: { workspace: 12, security: 3 },
    top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
    period,
    shacl_validated: 737,
    shacl_rejections: 12,
  };
}

/** Echoes the requested ?period= so current and previous months render as
 * distinct legend labels (the v5 chart is period-over-period). */
function periodAwareFetch() {
  return vi.fn(async (url: string) => {
    const period = new URL(url, "http://localhost").searchParams.get("period") ?? "2026-07";
    return jsonResponse(summaryFor(period));
  });
}

describe("AuditDashboardPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the chain badge, counts, friendly actors, and the logs link", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent("Valid"));
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    // v5: SHACL health tiles from the same summary.
    expect(screen.getByTestId("shacl-validated")).toHaveTextContent("98.4%");
    expect(screen.getByTestId("shacl-rejections")).toHaveTextContent("12");
    // Current period appears once (as the current-series legend label).
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    // v5: friendly actor label (last IRI segment), raw IRI kept in the row title.
    expect(screen.getByTestId("top-actors-list")).toHaveTextContent("abc123");
    expect(screen.getByTestId("top-actors-list")).toHaveTextContent("45");
    expect(screen.getByRole("link", { name: "View logs" })).toHaveAttribute("href", "/audit/logs");
  });

  // AC-1 + AC-3: KPI tiles + drill-in bar chart, not plain text rows.
  it("renders KPI tiles and a drill-in bar chart, not text rows", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("bar-chart")).toBeInTheDocument());
    expect(screen.getByTestId("chain-status")).toHaveTextContent("Valid");
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    expect(screen.getAllByTestId("bar-chart-segment").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "workspace" })).toHaveAttribute(
      "href",
      "/audit/logs?event_type=workspace"
    );
  });

  it("shows a muted load error when the summary fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502))
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("audit-error")).toBeInTheDocument());
  });
});
