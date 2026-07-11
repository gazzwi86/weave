import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCoverageGaps } from "../fetch-coverage-gaps";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchCoverageGaps", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs the coverage-gap proxy route and returns the row list", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        rows: [{ entity_iri: "https://weave.example/entity/onboard-customer", missing_link: "https://weave.example/ontology/bpmo#performedBy" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCoverageGaps(10_000);

    expect(fetchMock).toHaveBeenCalledWith("/api/proxy/sparql/coverage-gap", expect.objectContaining({ signal: expect.anything() }));
    expect(result).toEqual({
      type: "ok",
      rows: [{ entityIri: "https://weave.example/entity/onboard-customer", missingLink: "https://weave.example/ontology/bpmo#performedBy" }],
    });
  });

  // AC-2
  it("returns an empty row list when there are no gaps", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ rows: [], message: "No coverage gaps found" })));

    const result = await fetchCoverageGaps(10_000);

    expect(result).toEqual({ type: "ok", rows: [] });
  });

  // AC-3
  it("returns an error result on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "store_unavailable" }, 503)));

    const result = await fetchCoverageGaps(10_000);

    expect(result).toEqual({ type: "error", status: 503 });
  });

  // AC-3
  it("returns a network-error result (status 0) instead of throwing when fetch rejects/aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      })
    );

    const result = await fetchCoverageGaps(10_000);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
