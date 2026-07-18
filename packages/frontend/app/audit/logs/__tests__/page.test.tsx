import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast/toast-provider";

import AuditLogsPage from "../page";

// Toasts require a ToastProvider ancestor -- app-shell.tsx mounts one for the
// real app; the page is rendered standalone here, so tests provide it too.
function renderPage() {
  return render(
    <ToastProvider>
      <AuditLogsPage />
    </ToastProvider>
  );
}

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

const ROW = "table-row-7";
const DETAIL = "table-row-detail-7";

const VERIFY_OK = { valid: true, entries_checked: 42, first_broken_seq: null, error: null };
const VERIFY_BROKEN = { valid: false, entries_checked: 42, first_broken_seq: 3, error: null };

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
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
  });

  it("renders a table row per audit entry", async () => {
    stubAuditFetch();

    renderPage();

    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());
    expect(screen.getByTestId(ROW)).toHaveTextContent("workspace.created");
    expect(screen.getByTestId(ROW)).toHaveTextContent("urn:weave:workspace:ws-1");
  });

  it("shows the admin-only denied copy on a 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "forbidden" }, 403))
    );

    renderPage();

    await waitFor(() => expect(screen.getByTestId("logs-denied")).toBeInTheDocument());
    expect(screen.getByTestId("logs-denied")).toHaveTextContent(
      "Audit log access is available to workspace admins only."
    );
  });

  it("expands a clicked row to the full signed entry (hash chain fields)", async () => {
    stubAuditFetch();

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId(ROW));

    const detail = screen.getByTestId(DETAIL);
    expect(detail).toHaveTextContent(ENTRY.actor_principal_iri);
    expect(detail).toHaveTextContent(ENTRY.target_iri);
    expect(detail).toHaveTextContent("hash-7-value");
    expect(detail).toHaveTextContent("hash-6-value");
    expect(detail).toHaveTextContent("sig-7");
    expect(detail).toHaveTextContent("1 field changed.");
    expect(within(detail).getByRole("button", { name: "Export JSON" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Copy IRI" })).toBeInTheDocument();
  });

  it("clicking Export JSON / Copy IRI in the detail row does not collapse the row", async () => {
    stubAuditFetch();

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId(ROW));

    const detail = screen.getByTestId(DETAIL);
    fireEvent.click(within(detail).getByRole("button", { name: "Copy IRI" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ENTRY.target_iri);
    expect(screen.getByTestId(DETAIL)).toBeInTheDocument();
  });

  it("initialises the event-type filter from the URL and fetches filtered", async () => {
    const fetchMock = stubAuditFetch();
    window.history.pushState({}, "", "/audit/logs?event_type=seed");

    renderPage();

    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());
    expect(screen.getByLabelText("Event type")).toHaveValue("seed");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("event_type=seed");
  });

  it("verify chain toasts an info message then the real success result", async () => {
    stubAuditFetch(VERIFY_OK);

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(await screen.findByText("Verifying 1 entries…")).toBeInTheDocument();
    expect(await screen.findByText("Chain valid — 42 entries checked.")).toBeInTheDocument();
  });

  it("verify chain toasts the real broken result", async () => {
    stubAuditFetch(VERIFY_BROKEN);

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(
      await screen.findByText("Chain broken at seq 3 — 42 entries checked.")
    ).toBeInTheDocument();
  });

  // AC-4: test_logs_table_shows_relative_time_and_entity_ref_not_raw
  it("test_logs_table_shows_relative_time_and_entity_ref_not_raw", async () => {
    stubAuditFetch();

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    // Raw ISO timestamp is never primary text -- it's the <time> hover title.
    expect(screen.queryByText(ENTRY.ts)).not.toBeInTheDocument();
    const timeEl = screen.getByTestId(ROW).querySelector("time");
    expect(timeEl).toHaveAttribute("title", ENTRY.ts);

    // Raw actor URN is never bare text -- it's EntityRef's secondary mono id.
    expect(screen.getByText(ENTRY.actor_principal_iri)).toHaveClass("font-[var(--font-mono)]");
  });

  // AC-5: test_logs_filter_bar_exposes_all_seven_query_dimensions
  it("test_logs_filter_bar_exposes_all_seven_query_dimensions", async () => {
    stubAuditFetch();

    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Engine")).toBeInTheDocument());

    expect(screen.getByLabelText("Event type")).toBeInTheDocument();
    expect(screen.getByLabelText("Actor")).toBeInTheDocument();
    expect(screen.getByLabelText("Target")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("event type field hints at prefix matching", async () => {
    stubAuditFetch();

    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Event type")).toBeInTheDocument());

    expect(screen.getByLabelText("Event type")).toHaveAttribute("placeholder", "ce.* or exact");
  });

  it("header Export button downloads the current page as JSON", async () => {
    stubAuditFetch();
    const clickSpy = vi.fn();
    const createObjectURL = vi.fn(() => "blob:mock");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    renderPage();
    await waitFor(() => expect(screen.getByTestId(ROW)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(clickSpy).toHaveBeenCalled();
  });
});
