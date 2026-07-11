import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchGlossarySearch } from "../fetch-glossary-search";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchGlossarySearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the search query to /api/proxy/sparql and reshapes rows (AC-002-01)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        rows: [
          { iri: "urn:term:invoice", prefLabel: "Invoice", definition: "A bill.", owlRole: "true" },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGlossarySearch("invoice", 5000);

    expect(result).toEqual({
      type: "ok",
      rows: [{ iri: "urn:term:invoice", prefLabel: "Invoice", definition: "A bill.", isOwlClass: true }],
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/proxy/sparql");
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain("invoice");
  });

  it("treats a missing definition as null, never a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { rows: [{ iri: "urn:term:x", prefLabel: "X", owlRole: "false" }] })
      )
    );

    const result = await fetchGlossarySearch("x", 5000);

    expect(result).toEqual({ type: "ok", rows: [{ iri: "urn:term:x", prefLabel: "X", definition: null, isOwlClass: false }] });
  });

  it("resolves to an error result on a non-ok response, never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "store_unavailable" })));

    const result = await fetchGlossarySearch("invoice", 5000);

    expect(result).toEqual({ type: "error", status: 503 });
  });
});
