import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTypeCounts } from "../use-type-counts";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const SPARQL_PAGE = {
  rows: [
    { subject: "urn:a", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" },
    { subject: "urn:b", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" },
    { subject: "urn:c", predicate: RDF_TYPE, object: "https://weave.io/ontology/Actor" },
  ],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTypeCounts", () => {
  it("tallies per-kind instance counts from the CE-READ-1 SPARQL pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(SPARQL_PAGE))
    );

    const { result } = renderHook(() => useTypeCounts());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.countsByKind).toEqual({ Process: 2, Actor: 1 });
  });

  it("stays not-ready on a fetch failure so the caller keeps showing the placeholder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "down" }, 502))
    );

    const { result } = renderHook(() => useTypeCounts());

    await waitFor(() => expect(result.current.countsByKind).toEqual({}));
    expect(result.current.ready).toBe(false);
  });
});
