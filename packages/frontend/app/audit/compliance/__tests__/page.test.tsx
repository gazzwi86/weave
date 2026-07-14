import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CompliancePage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CURRENT_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
  shacl_validated: 30,
  shacl_rejections: 2,
};

const PREVIOUS_SUMMARY = {
  ...CURRENT_SUMMARY,
  by_event_category: { workspace: 9, security: 3 },
  period: "2026-06",
  shacl_validated: 20,
  shacl_rejections: 5,
};

/** Routes the mocked fetch by the `period` query param, same two-period
 * fetch pattern `useCompliance` issues (current + previous month).
 */
function stubTwoPeriodFetch(opts: {
  current?: Response;
  previous?: Response | null;
}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("period=2026-07")) {
        return opts.current ?? jsonResponse(CURRENT_SUMMARY);
      }
      if (opts.previous === null) {
        throw new Error("network_error");
      }
      return opts.previous ?? jsonResponse(PREVIOUS_SUMMARY);
    })
  );
}

describe("CompliancePage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // Fake Date only -- waitFor's internal polling needs real timers.
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date(Date.UTC(2026, 6, 15)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders chain status and event category counts (AC-7)", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent("valid"));
    expect(screen.getByTestId("entries-checked")).toHaveTextContent("42");
    expect(screen.getByRole("link", { name: "workspace" })).toHaveAttribute(
      "href",
      "/audit/logs?event_type=workspace"
    );
  });

  // AC-1: test_audit_dashboard_renders_kpi_tiles_not_text_rows (compliance side)
  it("renders chain-status/entries-checked/SHACL figures as KpiTile tiles, not text rows", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("shacl-validated")).toHaveTextContent("30"));
    expect(screen.getByTestId("shacl-rejections")).toHaveTextContent("2");
    expect(screen.queryByText(/SHACL validated: 30/)).not.toBeInTheDocument();
  });

  it("never renders a diff_summary field, for any role (AC-7 structural redaction)", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.queryByText(/diff_summary/i)).not.toBeInTheDocument();
  });

  it("shows a load error when the current-month compliance fetch fails", async () => {
    stubTwoPeriodFetch({ current: jsonResponse({ error: "upstream_unavailable" }, 502) });

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("compliance-error")).toBeInTheDocument());
  });

  // AC-2: test_compliance_trend_renders_as_bar_chart_not_text_glyph
  it("test_compliance_trend_renders_as_bar_chart_not_text_glyph", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("bar-chart")).toBeInTheDocument());
    // Two series (previous + current) x two categories = 4 segments.
    expect(screen.getAllByTestId("bar-chart-segment")).toHaveLength(4);
    expect(screen.queryByText("▲")).not.toBeInTheDocument();
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("degrades to an empty-state chart when the previous-month fetch fails (no fake zero bar)", async () => {
    stubTwoPeriodFetch({ previous: null });

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("compliance-error")).not.toBeInTheDocument();
  });

  it("renders the SHACL conformance section with counts and a link to /ce/types", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("shacl-validated")).toHaveTextContent("30"));
    expect(screen.getByTestId("shacl-rejections")).toHaveTextContent("2");
    const link = screen.getByRole("link", { name: /view kinds & shape constraints/i });
    expect(link).toHaveAttribute("href", "/ce/types");
  });
});
