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
    expect(screen.getByTestId("event-category-list")).toHaveTextContent("workspace: 12");
    expect(screen.getByTestId("event-category-list")).toHaveTextContent("security: 3");
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

  it("renders month-over-month deltas per category when the previous month loads", async () => {
    stubTwoPeriodFetch({});

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    const deltas = screen.getAllByTestId("category-delta");
    // workspace: 12 - 9 = +3, security: 3 - 3 = 0
    expect(deltas[0]).toHaveTextContent("▲ 3");
    expect(deltas[1]).toHaveTextContent("—");
  });

  it("degrades silently to no deltas when the previous-month fetch fails", async () => {
    stubTwoPeriodFetch({ previous: null });

    render(<CompliancePage />);

    await waitFor(() => expect(screen.getByTestId("chain-status")).toBeInTheDocument());
    expect(screen.queryByTestId("category-delta")).not.toBeInTheDocument();
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
