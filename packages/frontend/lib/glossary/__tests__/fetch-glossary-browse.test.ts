import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchGlossaryBrowse } from "../fetch-glossary-browse";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubBrowseFetch(rows: unknown[], status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => jsonResponse(status, { rows }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const INVOICE_BROWSE_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  owlRole: "true",
  broader: "urn:term:financial-document",
  narrower: "urn:term:credit-note|urn:term:debit-note",
};

const INVOICE_TERM_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: null,
  isOwlClass: true,
  broaderIris: ["urn:term:financial-document"],
  narrowerIris: ["urn:term:credit-note", "urn:term:debit-note"],
};

describe("fetchGlossaryBrowse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("splits GROUP_CONCAT broader/narrower strings into chip IRI lists (AC-002-03)", async () => {
    stubBrowseFetch([INVOICE_BROWSE_ROW]);
    const result = await fetchGlossaryBrowse(1, 5000);
    expect(result).toEqual({ type: "ok", rows: [INVOICE_TERM_ROW] });
  });

  it("treats an empty GROUP_CONCAT string as no relationships, not one blank chip", async () => {
    stubBrowseFetch([{ iri: "urn:term:x", prefLabel: "X", owlRole: "false", broader: "", narrower: "" }]);
    const result = await fetchGlossaryBrowse(1, 5000);
    expect(result).toEqual({
      type: "ok",
      rows: [
        { iri: "urn:term:x", prefLabel: "X", definition: null, isOwlClass: false, broaderIris: [], narrowerIris: [] },
      ],
    });
  });

  it("treats an absent GROUP_CONCAT column (unbound, omitted by the proxy) as no relationships", async () => {
    stubBrowseFetch([{ iri: "urn:term:y", prefLabel: "Y", owlRole: "false" }]);
    const result = await fetchGlossaryBrowse(1, 5000);
    expect(result).toEqual({
      type: "ok",
      rows: [
        { iri: "urn:term:y", prefLabel: "Y", definition: null, isOwlClass: false, broaderIris: [], narrowerIris: [] },
      ],
    });
  });

  it("requests the offset for the given page", async () => {
    const fetchMock = stubBrowseFetch([]);

    await fetchGlossaryBrowse(3, 5000);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain("OFFSET 100");
  });

  it("resolves to an error result on a non-ok response, never throws", async () => {
    stubBrowseFetch([], 503);
    const result = await fetchGlossaryBrowse(1, 5000);
    expect(result).toEqual({ type: "error", status: 503 });
  });
});
