import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";

import GlossaryPage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// No broader/narrower link between these two -- filter/search tests need
// each row's presence to be unambiguous (a related-term chip renders its
// target's label even when that target's own row is filtered out, so a
// linked fixture pair would still leave both names in the DOM).
const APPLE_ROW = {
  iri: "urn:term:apple",
  prefLabel: "Apple",
  definition: "A fruit.",
  owlRole: "false",
  broader: "",
  narrower: "",
};
const LEDGER_ROW = {
  iri: "urn:term:ledger",
  prefLabel: "Ledger",
  definition: "A record of financial transactions.",
  owlRole: "false",
  broader: "",
  narrower: "",
};

const INVOICE_BROWSE_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: "A billing document.",
  owlRole: "true",
  broader: "urn:term:financial-document",
  narrower: "",
};

const FINANCIAL_DOCUMENT_BROWSE_ROW = {
  iri: "urn:term:financial-document",
  prefLabel: "Financial Document",
  definition: "",
  owlRole: "false",
  broader: "",
  narrower: "urn:term:invoice",
};

interface StubOptions {
  browseRows?: unknown[];
  applyResponse?: () => Response;
}

function stubFetch(options: StubOptions): ReturnType<typeof vi.fn> {
  const browseRows = options.browseRows ?? [INVOICE_BROWSE_ROW, FINANCIAL_DOCUMENT_BROWSE_ROW];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes("/api/proxy/sparql")) return jsonResponse({ rows: browseRows });
    if (url.includes("/api/operations/apply")) {
      return (options.applyResponse ?? (() => jsonResponse({ ref_map: { t1: "urn:term:obligation" } }, 201)))();
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <ToastProvider>
      <GlossaryPage />
    </ToastProvider>
  );
}

describe("GlossaryPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the browse page as a data table with related-term chips", async () => {
    stubFetch({});
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Invoice").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Financial Document").length).toBeGreaterThan(0);
    expect(screen.getByText("also class")).toBeInTheDocument();
  });

  it("filters rows by the alphabetic-range chips", async () => {
    stubFetch({ browseRows: [APPLE_ROW, LEDGER_ROW] });
    renderPage();

    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "A–F" }));

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Ledger")).not.toBeInTheDocument();
  });

  it("filters rows by the search box", async () => {
    stubFetch({ browseRows: [APPLE_ROW, LEDGER_ROW] });
    renderPage();

    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/search terms/i), { target: { value: "financial" } });

    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.getByText("Ledger")).toBeInTheDocument();
  });

  it("creates a new term via the drawer and shows a success toast (AC: real CE-WRITE-1 create)", async () => {
    stubFetch({ browseRows: [APPLE_ROW] });
    renderPage();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New term" }));
    const labelInput = await screen.findByLabelText("Label");
    fireEvent.change(labelInput, { target: { value: "Obligation" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A binding duty." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Created "Obligation"/)).toBeInTheDocument();
  });

  it("renders a sh:uniqueLang 422 as a plain-language error anchored in the drawer, not a toast (AC-002-04)", async () => {
    stubFetch({
      browseRows: [APPLE_ROW],
      applyResponse: () =>
        jsonResponse(
          {
            violations: [
              {
                path: "http://www.w3.org/2004/02/skos/core#prefLabel",
                message: "Values do not have unique language tags (duplicate language tag: en)",
              },
            ],
          },
          422
        ),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "New term" }));
    const labelInput = await screen.findByLabelText("Label");
    fireEvent.change(labelInput, { target: { value: "Apple" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/duplicate language tag/i);
    expect(dialog).toBeInTheDocument();
  });

  it("edits an existing term via update_node and shows a success toast", async () => {
    stubFetch({ browseRows: [APPLE_ROW], applyResponse: () => jsonResponse({}, 200) });
    renderPage();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit Apple" }));
    const labelInput = await screen.findByLabelText("Label");
    expect(labelInput).toHaveValue("Apple");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Saved changes to "Apple"/)).toBeInTheDocument();
  });

  it("toasts a not-available-yet message when a relationship chip was edited", async () => {
    stubFetch({ browseRows: [APPLE_ROW], applyResponse: () => jsonResponse({}, 200) });
    renderPage();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit Apple" }));
    await screen.findByLabelText("Label");
    fireEvent.change(screen.getByPlaceholderText(/type to find an entity or term/i), { target: { value: "Credit Note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Relationship edits aren't available yet/)).toBeInTheDocument();
  });

  it("deletes a term after confirmation, naming the dropped related-item count", async () => {
    stubFetch({ applyResponse: () => jsonResponse({}, 200) });
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Invoice").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "Delete Invoice" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Links from 1 related item will be dropped\./)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Deleted "Invoice"/)).toBeInTheDocument();
  });

  it("cancelling the delete confirmation makes no apply request", async () => {
    const fetchMock = stubFetch({ browseRows: [APPLE_ROW] });
    renderPage();
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Delete Apple" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => call[0].toString().includes("/api/operations/apply"))).toBe(false);
  });

  it("shows an ErrorCard with retry when the browse fetch fails", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "upstream_unavailable" }, 502));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    const errorCard = await screen.findByRole("alert");
    expect(within(errorCard).getByText(/Couldn't load the glossary/)).toBeInTheDocument();

    fetchMock.mockImplementation(async () => jsonResponse({ rows: [APPLE_ROW] }));
    fireEvent.click(within(errorCard).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
  });
});
