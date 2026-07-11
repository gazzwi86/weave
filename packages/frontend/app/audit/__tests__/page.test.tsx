import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuditDashboardPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const COMPLIANCE_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
};

describe("AuditDashboardPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the chain badge, counts, actors, and the logs link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(COMPLIANCE_SUMMARY))
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent("valid"));
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    expect(screen.getByTestId("top-actors-list")).toHaveTextContent(
      "urn:weave:principal:user:abc123: 45"
    );
    expect(screen.getByRole("link", { name: "View logs" })).toHaveAttribute(
      "href",
      "/audit/logs"
    );
  });

  // AC-1 + AC-3: test_audit_dashboard_renders_kpi_tiles_not_text_rows
  it("test_audit_dashboard_renders_kpi_tiles_not_text_rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(COMPLIANCE_SUMMARY))
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("bar-chart")).toBeInTheDocument());
    // KpiTile tiles, not plain <p> text rows.
    expect(screen.getByTestId("chain-status")).toHaveTextContent("valid");
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    // Category tiles render as a BarChart with drill-in links, not a plain list.
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
