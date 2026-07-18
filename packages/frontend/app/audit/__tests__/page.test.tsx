import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuditDashboardPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function summaryFor(period: string, extra: Record<string, unknown> = {}) {
  return {
    chain_status: "valid",
    entries_checked: 42,
    first_broken_seq: null,
    by_event_category: { workspace: 12, security: 3 },
    top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
    period,
    shacl_validated: 737,
    shacl_rejections: 12,
    ...extra,
  };
}

/** Echoes the requested ?period= so current and previous months render as
 * distinct series (the dashboard's category chart is period-over-period). */
function periodAwareFetch(extra: Record<string, unknown> = {}) {
  return vi.fn(async (url: string) => {
    const period = new URL(url, "http://localhost").searchParams.get("period") ?? "2026-07";
    return jsonResponse(summaryFor(period, extra));
  });
}

describe("AuditDashboardPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the chain status chip linking to Compliance, once loaded", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent(/valid/i));
    expect(screen.getByTestId("chain-status")).toHaveAttribute("href", "/audit/compliance");
  });

  it("renders the events-by-category bar chart with a drill-in link to logs", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("bar-chart")).toBeInTheDocument());
    expect(screen.getAllByTestId("bar-chart-segment").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "workspace" })).toHaveAttribute(
      "href",
      "/audit/logs?event_type=workspace"
    );
  });

  it("shows the model-edits-by-kind card as pending (G5 has no backing endpoint)", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.getByTestId("kind-edits-pending")).toBeInTheDocument();
  });

  it("shows busiest entities as pending when top_targets is absent from the response", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.getByTestId("busiest-entities-pending")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View logs" })).toHaveAttribute("href", "/audit/logs");
  });

  it("renders busiest entities from top_targets when the backend provides it", async () => {
    vi.stubGlobal(
      "fetch",
      periodAwareFetch({ top_targets: [{ target_iri: "urn:weave:process:order-handling", count: 48 }] })
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.queryByTestId("busiest-entities-pending")).not.toBeInTheDocument());
    expect(screen.getByText("order-handling")).toBeInTheDocument();
  });

  it("shows the Security/Governance/Budget/Reliability row as pending (G6 has no backing endpoint)", async () => {
    vi.stubGlobal("fetch", periodAwareFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Reliability")).toBeInTheDocument();
    expect(screen.getAllByTestId("event-counts-pending")).toHaveLength(4);
  });

  it("shows a load error when the summary fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502))
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("audit-error")).toBeInTheDocument());
  });
});
