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
    top_targets: [],
    audit_outages: 0,
    ...extra,
  };
}

const EMPTY_COUNTS = { counts: [] };
const EMPTY_KIND_ENTRIES = { entries: [], total: 0, page: 1, per_page: 200 };

interface FetchOverrides {
  complianceExtra?: Record<string, unknown>;
  counts?: () => Response;
  kindCounts?: () => Response;
}

/** Routes the single global `fetch` mock by URL, the way the real page does
 * three independent calls under the hood (compliance x2, counts,
 * operations.applied list). `overrides` lets a test swap in a different
 * body/status per call; anything left unset returns an empty-but-successful
 * response so tests that only care about one card don't have to stub all
 * three. The compliance response still echoes `?period=` so current and
 * previous months render as distinct series. */
function routedFetch(overrides: FetchOverrides = {}) {
  return vi.fn(async (url: string) => {
    const parsed = new URL(url, "http://localhost");
    if (parsed.pathname === "/api/audit/compliance") {
      const period = parsed.searchParams.get("period") ?? "2026-07";
      return jsonResponse(summaryFor(period, overrides.complianceExtra));
    }
    if (parsed.pathname === "/api/audit/counts") {
      return overrides.counts ? overrides.counts() : jsonResponse(EMPTY_COUNTS);
    }
    if (parsed.pathname === "/api/audit") {
      return overrides.kindCounts ? overrides.kindCounts() : jsonResponse(EMPTY_KIND_ENTRIES);
    }
    throw new Error(`unhandled fetch in test: ${url}`);
  });
}

describe("AuditDashboardPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the chain status chip linking to Compliance, once loaded", async () => {
    vi.stubGlobal("fetch", routedFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toHaveTextContent(/valid/i));
    expect(screen.getByTestId("chain-status")).toHaveAttribute("href", "/audit/compliance");
  });

  it("renders the events-by-category bar chart with a drill-in link to logs", async () => {
    vi.stubGlobal("fetch", routedFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("bar-chart")).toBeInTheDocument());
    expect(screen.getAllByTestId("bar-chart-segment").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "workspace" })).toHaveAttribute(
      "href",
      "/audit/logs?event_type=workspace"
    );
  });

  it("sums operations.applied kind_counts (G5) into the Model-edits-by-kind card", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        kindCounts: () =>
          jsonResponse({
            entries: [
              {
                seq: 1,
                ts: "2026-07-10T00:00:00Z",
                actor_principal_iri: "urn:weave:principal:tenant-1:human:alice",
                engine: "constitution",
                event_type: "operations.applied",
                target_iri: "urn:weave:version:v1",
                diff_summary: { kind_counts: { Process: 3, edges: 1 } },
                hash: "h1",
                prev_hash: "h0",
                signature: "sig",
              },
            ],
            total: 1,
            page: 1,
            per_page: 200,
          }),
      })
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.queryByTestId("kind-edits-pending")).not.toBeInTheDocument());
    expect(screen.getByText("Process").closest("li")).toHaveTextContent("3");
    expect(screen.getByText("edges").closest("li")).toHaveTextContent("1");
  });

  it("shows the Model-edits-by-kind card as a genuine empty state when there were no edits this month", async () => {
    vi.stubGlobal("fetch", routedFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("kind-edits-empty")).toBeInTheDocument());
  });

  it("shows the Model-edits-by-kind card as pending when the caller isn't a tenant admin (403)", async () => {
    vi.stubGlobal("fetch", routedFetch({ kindCounts: () => jsonResponse({ error: "forbidden" }, 403) }));

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("kind-edits-pending")).toBeInTheDocument());
  });

  it("shows busiest entities as pending when top_targets is empty in the response", async () => {
    vi.stubGlobal("fetch", routedFetch());

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.getByTestId("busiest-entities-pending")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View logs" })).toHaveAttribute("href", "/audit/logs");
  });

  it("renders busiest entities from top_targets when the backend provides it", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        complianceExtra: { top_targets: [{ target_iri: "urn:weave:process:order-handling", count: 48 }] },
      })
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.queryByTestId("busiest-entities-pending")).not.toBeInTheDocument());
    expect(screen.getByText("order-handling")).toBeInTheDocument();
  });

  it("wires the Security/Governance/Budget/Reliability row to /api/audit/counts (G6+G8), leaving only Policies changed pending", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        counts: () =>
          jsonResponse({
            counts: [
              { event_type: "access.rbac.denied", count: 3 },
              { event_type: "security.cross_tenant.rejected", count: 0 },
              { event_type: "governance.shape_committed", count: 2 },
              { event_type: "standard_upserted", count: 1 },
              { event_type: "billing.cap.changed", count: 1 },
              { event_type: "build.budget.breach", count: 0 },
              { event_type: "audit_outage", count: 0 },
              { event_type: "write_back_fail_shacl", count: 2 },
            ],
          }),
      })
    );

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByText("Security")).toBeInTheDocument());
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Reliability")).toBeInTheDocument();

    expect(screen.getByText("Access denied").closest("li")).toHaveTextContent("3");
    expect(screen.getByText("Rules committed").closest("li")).toHaveTextContent("2");
    expect(screen.getByText("Cap changes").closest("li")).toHaveTextContent("1");
    expect(screen.getByText("Failed write-backs").closest("li")).toHaveTextContent("2");

    // Policies changed has no backend event_type source (see report) --
    // stays pending even though the rest of the Governance card is live.
    expect(screen.getByText("Policies changed").closest("li")).toHaveTextContent(/not available/i);
    expect(screen.getAllByTestId("event-counts-pending")).toHaveLength(1);
  });

  it("shows the whole Security/Governance/Budget/Reliability row as pending when the caller isn't a tenant admin (403)", async () => {
    vi.stubGlobal("fetch", routedFetch({ counts: () => jsonResponse({ error: "forbidden" }, 403) }));

    render(<AuditDashboardPage />);

    await waitFor(() => expect(screen.getByText("Access denied")).toBeInTheDocument());
    // All 9 metric rows pending (2 Security + 3 Governance + 2 Budget + 2
    // Reliability), incl. Policies changed which is always pending regardless.
    expect(screen.getAllByTestId("event-counts-pending")).toHaveLength(9);
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
