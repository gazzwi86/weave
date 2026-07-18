import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast/toast-provider";

import CompliancePage from "../page";

// Toasts require a ToastProvider ancestor -- same pattern as
// app/audit/logs/__tests__/page.test.tsx.
function renderPage() {
  return render(
    <ToastProvider>
      <CompliancePage />
    </ToastProvider>
  );
}

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

const PREVIOUS_SUMMARY = { ...CURRENT_SUMMARY, period: "2026-06" };

const BROKEN_SUMMARY = { ...CURRENT_SUMMARY, chain_status: "broken", first_broken_seq: 17 };

/** Routes the mocked fetch by the `period` query param, same two-period
 * fetch pattern `useCompliance` issues (current + previous month). */
function stubTwoPeriodFetch(opts: { current?: Response; previous?: Response | null }): void {
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
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a success verdict band when the chain is valid, scoped to what's actually verified", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("compliance-verdict")).toBeInTheDocument());
    const verdict = screen.getByTestId("compliance-verdict");
    expect(verdict).toHaveTextContent("42");
    // Must not assert a claim we have no data for.
    expect(verdict).not.toHaveTextContent(/no (critical )?(policy )?violation/i);
  });

  it("shows a danger verdict band when the chain is broken", async () => {
    stubTwoPeriodFetch({ current: jsonResponse(BROKEN_SUMMARY) });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("compliance-verdict")).toBeInTheDocument());
    expect(screen.getByTestId("compliance-verdict")).toHaveTextContent(/broken/i);
    expect(screen.getByTestId("compliance-verdict")).toHaveTextContent("17");
  });

  it("renders the chain stat card with entries verified", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("stat-chain")).toHaveTextContent("Valid"));
    expect(screen.getByTestId("stat-chain")).toHaveTextContent("42");
  });

  it("renders policy-violations and coverage-gaps stat cards as pending -- no backend field exists for either", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("stat-policy-violations")).toBeInTheDocument());
    expect(screen.getByTestId("stat-policy-violations")).toHaveTextContent(/not available/i);
    expect(screen.getByTestId("stat-coverage-gaps")).toHaveTextContent(/not available/i);
  });

  it("renders the audit-outages stat card as pending when the field is absent from the response (G8, PR #135 unmerged)", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("stat-audit-outages")).toBeInTheDocument());
    expect(screen.getByTestId("stat-audit-outages")).toHaveTextContent(/not available/i);
  });

  it("renders a real audit-outages count once the backend serves it", async () => {
    stubTwoPeriodFetch({ current: jsonResponse({ ...CURRENT_SUMMARY, audit_outages: 3 }) });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("stat-audit-outages")).toHaveTextContent("3"));
    expect(screen.getByTestId("stat-audit-outages")).not.toHaveTextContent(/not available/i);
  });

  it("lists a chain-broken attention row with a jump link to the logs, when the chain is broken", async () => {
    stubTwoPeriodFetch({ current: jsonResponse(BROKEN_SUMMARY) });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("attention-list")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /chain broken at entry 17/i });
    expect(link).toHaveAttribute("href", "/audit/logs");
  });

  it("shows an honest empty state in the attention list when the chain is valid and no outages are reported", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("attention-empty")).toBeInTheDocument());
  });

  it("exports evidence as a JSON download and confirms with a toast", async () => {
    stubTwoPeriodFetch({});
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /export evidence/i })).toBeInTheDocument());
    screen.getByRole("button", { name: /export evidence/i }).click();

    expect(clickSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/evidence exported/i));
  });

  it("shows a load error when the current-month compliance fetch fails", async () => {
    stubTwoPeriodFetch({ current: jsonResponse({ error: "upstream_unavailable" }, 502) });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("compliance-error")).toBeInTheDocument());
  });

  it("never renders a diff_summary field, for any role (AC-7 structural redaction)", async () => {
    stubTwoPeriodFetch({});

    renderPage();

    await waitFor(() => expect(screen.getByTestId("compliance-verdict")).toBeInTheDocument());
    expect(screen.queryByText(/diff_summary/i)).not.toBeInTheDocument();
  });
});
