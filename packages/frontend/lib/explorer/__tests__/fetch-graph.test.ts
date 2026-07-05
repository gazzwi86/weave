import { beforeEach, describe, expect, it, vi } from "vitest";

import { CeReadError } from "../ce-read-error";
import { fetchGraph, fetchPalette } from "../fetch-graph";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchPalette", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the palette kinds from /api/proxy/node-kinds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] })
      )
    );

    const kinds = await fetchPalette();

    expect(kinds).toEqual([{ id: "Process", label: "Process", colour: "#3B82F6" }]);
  });

  it("throws CeReadError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "unauthorised" }, 401)));

    await expect(fetchPalette()).rejects.toBeInstanceOf(CeReadError);
  });
});

describe("fetchGraph", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-1 + brief's integration test: "should call CE-READ-1 /api/sparql with
  // Cognito JWT and build correct Cytoscape element set from paginated rows".
  // The JWT itself is attached server-side by the proxy route (see
  // app/api/proxy/sparql/route.ts) -- this client-side fetch never handles
  // it directly, matching the codebase's existing auth pattern (search
  // route) rather than the brief's literal client-held-JWT pseudocode.
  it("paginates CE-READ-1 SPARQL calls until has_more_pages is false and merges rows into one element set", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("page=0")) {
        return jsonResponse({
          rows: [{ subject: "urn:a", predicate: "urn:rel", object: "urn:b", label: "A" }],
          columns: [],
          has_more_pages: true,
          page: 0,
        });
      }
      return jsonResponse({
        rows: [{ subject: "urn:b", predicate: "urn:rel", object: "urn:c", label: "B" }],
        columns: [],
        has_more_pages: false,
        page: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const elements = await fetchGraph(10_000);
    const nodeIds = elements.filter((el) => !el.data.source).map((el) => el.data.id);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/proxy/sparql?version=latest&page=0")
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/proxy/sparql?version=latest&page=1")
    );
    // urn:b appears in both pages -- must be deduped, not doubled.
    expect(nodeIds.sort()).toEqual(["urn:a", "urn:b", "urn:c"]);
  });

  it("throws CeReadError and stops paginating on a non-2xx response (AC-2)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "store_unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGraph(10_000)).rejects.toBeInstanceOf(CeReadError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchGraph -- timeout and isolation", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws CeReadError when the timeout deadline is exceeded before has_more_pages resolves", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ rows: [], columns: [], has_more_pages: true, page: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGraph(-5_000)).rejects.toBeInstanceOf(CeReadError);
  });

  // AC-9: cross-tenant isolation is enforced server-side (CE-READ-1 scopes
  // the named graph from the JWT's tenant claim; the proxy route never
  // forwards a `graph=` override -- see route.test.ts). A tenant-A JWT that
  // matches zero tenant-B rows produces zero Cytoscape elements client-side.
  it("produces zero elements when CE-READ-1 returns an empty row set (cross-tenant isolation)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ rows: [], columns: [], has_more_pages: false, page: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const elements = await fetchGraph(10_000);

    expect(elements).toEqual([]);
  });

  // QA edge case: a *legitimately empty* graph (workspace has no rows yet)
  // is a single successful 200 page, not an error -- distinct from AC-2's
  // CE-error path. fetchGraph must resolve (not throw) so the caller renders
  // the (empty) canvas, not the CE-error empty-state.
  it("resolves to zero elements for a single-page graph with no rows, without throwing", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ rows: [], columns: [], has_more_pages: false, page: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGraph(10_000)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
