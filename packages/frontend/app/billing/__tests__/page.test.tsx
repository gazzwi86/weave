import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BillingPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const USAGE_SUMMARY = {
  period: "2026-07",
  total_tokens: 1500,
  total_runs: 3,
  total_cost_usd: 12.5,
  by_workspace: [
    { workspace_id: "ws-1", total_tokens: 1500, total_runs: 3, total_cost_usd: 12.5 },
  ],
  cap_utilisation_pct: 25.0,
};

describe("BillingPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the tenant-wide usage summary (AC-5)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(USAGE_SUMMARY))
    );

    render(<BillingPage />);

    await waitFor(() => expect(screen.getByTestId("total-cost")).toHaveTextContent("12.50"));
    expect(screen.getByTestId("total-tokens")).toHaveTextContent("1500");
    expect(screen.getByTestId("total-runs")).toHaveTextContent("3");
  });

  it("shows a load error when the usage fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502))
    );

    render(<BillingPage />);

    await waitFor(() => expect(screen.getByTestId("usage-error")).toBeInTheDocument());
  });

  // AC-2: the "Budget cap reached" banner is what the E2E spec asserts on
  // (Playwright can't easily assert internal state, only rendered text) --
  // this test proves the banner text and values come from the 429 body.
  it("shows a budget-cap-reached banner when the simulated call is rejected", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("simulate-ai-call")) {
        return jsonResponse(
          {
            detail: {
              error: "budget_cap_reached",
              effective_cap_usd: 10.0,
              consumed_usd: 10.0,
            },
          },
          429
        );
      }
      return jsonResponse(USAGE_SUMMARY);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BillingPage />);
    await waitFor(() => expect(screen.getByTestId("total-cost")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Workspace ID"), { target: { value: "ws-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Simulate AI call" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Budget cap reached"));
    expect(screen.getByRole("alert")).toHaveTextContent("$10.00 of $10.00");
  });
});
