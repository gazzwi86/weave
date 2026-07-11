import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import GlossaryPage from "../page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const INVOICE_SEARCH_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: "A billing document.",
  owlRole: "true",
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
  searchRows?: unknown[];
  browsePages?: unknown[][];
  applyResponse?: () => Response;
  chatStatus?: number;
}

function handleSparqlRoute(init: RequestInit | undefined, options: StubOptions, browsePages: unknown[][]): Response {
  const body = JSON.parse((init?.body as string) ?? "{}") as { query: string };
  if (!body.query.includes("GROUP_CONCAT")) {
    return jsonResponse(200, { rows: options.searchRows ?? [] });
  }
  const offsetMatch = /OFFSET (\d+)/.exec(body.query);
  const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
  const pageIndex = offset / 50;
  return jsonResponse(200, { rows: browsePages[pageIndex] ?? [] });
}

function handleApplyRoute(options: StubOptions): Response {
  return (options.applyResponse ?? (() => jsonResponse(201, { ref_map: { t1: "urn:term:obligation" } })))();
}

function stubFetch(options: StubOptions): void {
  const browsePages = options.browsePages ?? [[INVOICE_BROWSE_ROW, FINANCIAL_DOCUMENT_BROWSE_ROW]];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes("/api/proxy/sparql")) return handleSparqlRoute(init, options, browsePages);
      if (url.includes("/api/operations/apply")) return handleApplyRoute(options);
      if (url.includes("/api/ontology/authoring/nl")) return jsonResponse(options.chatStatus ?? 200, { operations: [] });
      return jsonResponse(200, {});
    })
  );
}

describe("GlossaryPage -- search and browse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubFetch({});
    const { container } = render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("searches and shows a matching term with its owl-role badge (AC-002-01)", async () => {
    stubFetch({ searchRows: [INVOICE_SEARCH_ROW] });
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");

    fireEvent.change(screen.getByLabelText(/search glossary/i), { target: { value: "invoice" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const results = await screen.findByTestId("glossary-search-results");
    expect(within(results).getByText("Invoice")).toBeInTheDocument();
    expect(within(results).getByText("also class")).toBeInTheDocument();
  });

  it("shows the browse list ordered with owl-role badge and broader/narrower chips (AC-002-03)", async () => {
    stubFetch({});
    render(<GlossaryPage />);

    await screen.findByTestId("glossary-browse-list");
    // Scoped to each term's own row: "Invoice" also appears as the
    // Financial Document row's narrower chip, so an unscoped query is
    // ambiguous by design (both directions of the same edge are shown).
    const invoiceRow = screen.getByTestId("glossary-row-urn:term:invoice");
    expect(within(invoiceRow).getByText("Invoice")).toBeInTheDocument();
    const financialDocumentRow = screen.getByTestId("glossary-row-urn:term:financial-document");
    expect(within(financialDocumentRow).getByText("Financial Document")).toBeInTheDocument();
    expect(screen.getAllByText("also class")).toHaveLength(1);
    expect(within(invoiceRow).getByRole("button", { name: "Financial Document" })).toBeInTheDocument();
  });

  it("paginates the browse list via Next, requesting the next 50-row offset (AC-002-03)", async () => {
    const page2Row = { ...INVOICE_BROWSE_ROW, iri: "urn:term:credit-note", prefLabel: "Credit Note" };
    stubFetch({ browsePages: [[INVOICE_BROWSE_ROW, FINANCIAL_DOCUMENT_BROWSE_ROW], [page2Row]] });
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByText("Credit Note")).toBeInTheDocument());
    expect(screen.queryByText("Invoice")).not.toBeInTheDocument();
  });

  it("clicking a broader chip highlights the target row (navigate broader chip)", async () => {
    stubFetch({});
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");

    fireEvent.click(screen.getByRole("button", { name: "Financial Document" }));

    const target = screen.getByTestId("glossary-row-urn:term:financial-document");
    expect(target).toHaveAttribute("aria-current", "true");
  });
});

// Split from the block above to stay under the Law E per-function line
// budget -- covers the create-term flow (empty-state + 422 + chat degradation).
describe("GlossaryPage -- create term", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the create-term form from a zero-result search (AC-002-02)", async () => {
    stubFetch({ searchRows: [] });
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");

    fireEvent.change(screen.getByLabelText(/search glossary/i), { target: { value: "obligation" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const emptyState = await screen.findByTestId("glossary-empty-state");
    expect(within(emptyState).getByLabelText(/preferred label/i)).toHaveValue("obligation");
  });

  it("maps a 422 uniqueLang violation onto the preferred-label field, naming the language (AC-002-04)", async () => {
    stubFetch({
      searchRows: [],
      applyResponse: () =>
        jsonResponse(422, {
          violations: [
            {
              path: "http://www.w3.org/2004/02/skos/core#prefLabel",
              message: "Values do not have unique language tags (duplicate language tag: en)",
            },
          ],
        }),
    });
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");
    fireEvent.change(screen.getByLabelText(/search glossary/i), { target: { value: "obligation" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByTestId("glossary-empty-state");

    fireEvent.change(screen.getByLabelText(/definition/i), { target: { value: "A binding duty." } });
    fireEvent.click(screen.getByRole("button", { name: "Create term" }));

    await expect(screen.findByText(/duplicate language tag: en/i)).resolves.toBeInTheDocument();
    expect(screen.getByLabelText(/preferred label/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the create-term form working when the chat surface returns 503 (AC-002-05)", async () => {
    stubFetch({ searchRows: [], chatStatus: 503 });
    render(<GlossaryPage />);
    await screen.findByTestId("glossary-browse-list");
    fireEvent.change(screen.getByLabelText(/search glossary/i), { target: { value: "obligation" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByTestId("glossary-empty-state");

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "add a term" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    fireEvent.change(screen.getByLabelText(/definition/i), { target: { value: "A binding duty." } });
    fireEvent.click(screen.getByRole("button", { name: "Create term" }));

    await waitFor(() => expect(screen.getByText(/created urn:term:obligation/i)).toBeInTheDocument());
  });
});
