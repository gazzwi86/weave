import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuditLogsPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ENTRY = {
  seq: 7,
  ts: "2026-07-08T10:00:00Z",
  actor_principal_iri: "urn:weave:principal:user:abc123",
  engine: "ce",
  event_type: "workspace.created",
  target_iri: "urn:weave:workspace:ws-1",
  diff_summary: { name: "Acme" },
  hash: "hash-7-value",
  prev_hash: "hash-6-value",
  signature: "sig-7",
};

const LOG_PAGE = { entries: [ENTRY], total: 1, page: 1, per_page: 50 };

const ROW = "log-row-7";
const DETAIL = "log-detail-7";
const VERIFY_BADGE = "verify-result";

const VERIFY_OK = { valid: true, entries_checked: 42, first_broken_seq: null, error: null };

function stubAuditFetch(verify: unknown = VERIFY_OK) {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes("/api/audit/verify") ? jsonResponse(verify) : jsonResponse(LOG_PAGE)
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AuditLogsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/audit/logs");
  });

  it("renders a table row per audit entry", async () => {
    stubAuditFetch();

    render(<AuditLogsPage />);

    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());
    expect(screen.getByTestId(ROW)).toHaveTextContent("workspace.created");
    expect(screen.getByTestId(ROW)).toHaveTextContent("urn:weave:workspace:ws-1");
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it("shows the admin-only denied copy on a 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "forbidden" }, 403))
    );

    render(<AuditLogsPage />);

    await waitFor(() => expect(screen.getByTestId("logs-denied")).toBeInTheDocument());
    expect(screen.getByTestId("logs-denied")).toHaveTextContent(
      "Audit log access is available to workspace admins only."
    );
  });

  it("expands a clicked row to the full signed entry (hash chain fields)", async () => {
    stubAuditFetch();

    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId(ROW));

    expect(screen.getByTestId(DETAIL)).toHaveTextContent("hash-7-value");
    expect(screen.getByTestId(DETAIL)).toHaveTextContent("hash-6-value");
    expect(screen.getByTestId(DETAIL)).toHaveTextContent("sig-7");
    expect(screen.getByTestId(DETAIL)).toHaveTextContent("diff_summary");
  });

  it("initialises the event-type filter from the URL and fetches filtered", async () => {
    const fetchMock = stubAuditFetch();
    window.history.pushState({}, "", "/audit/logs?event_type=seed");

    render(<AuditLogsPage />);

    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());
    expect(screen.getByLabelText("Event type")).toHaveValue("seed");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("event_type=seed");
  });

  it("verifies the chain on demand and renders the result badge", async () => {
    stubAuditFetch();

    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));

    await waitFor(() => expect(screen.getByTestId(VERIFY_BADGE)).toBeInTheDocument());
    expect(screen.getByTestId(VERIFY_BADGE)).toHaveTextContent("valid");
    expect(screen.getByTestId(VERIFY_BADGE)).toHaveTextContent("42 entries checked");
  });

  // AC-4: test_logs_table_shows_relative_time_and_entity_ref_not_raw
  it("test_logs_table_shows_relative_time_and_entity_ref_not_raw", async () => {
    stubAuditFetch();

    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    // Raw ISO timestamp is never primary text -- it's the <time> hover title.
    expect(screen.queryByText(ENTRY.ts)).not.toBeInTheDocument();
    const timeEl = screen.getByTestId(ROW).querySelector("time");
    expect(timeEl).toHaveAttribute("title", ENTRY.ts);

    // Raw actor URN is never bare text -- it's EntityRef's secondary mono id.
    expect(screen.getByText(ENTRY.actor_principal_iri)).toHaveClass("font-[var(--font-mono)]");

    // Seq column uses tabular-nums.
    expect(screen.getByText("7")).toHaveClass("tabular-nums");
  });

  // AC-5: test_logs_filter_bar_exposes_all_seven_query_dimensions
  it("test_logs_filter_bar_exposes_all_seven_query_dimensions", async () => {
    stubAuditFetch();

    render(<AuditLogsPage />);
    await waitFor(() => expect(screen.getByLabelText("Engine")).toBeInTheDocument());

    expect(screen.getByLabelText("Event type")).toBeInTheDocument();
    expect(screen.getByLabelText("Actor")).toBeInTheDocument();
    expect(screen.getByLabelText("Target")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});
