import { describe, expect, it, vi } from "vitest";

import { applySavedPositions, fetchLayoutPositions, resetLayoutPositions, saveLayoutPosition } from "../layout-client";
import type { CytoscapeElement } from "../types";

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const NODE_IRI = "urn:weave:x:1";

// TASK-004 AC-1/AC-3/AC-5: thin fetch/save/reset wrapper around the
// app/api/proxy/layout-positions route -- mirrors fetch-graph.ts's proxyFetch
// style (client never handles the bearer token directly).
describe("fetchLayoutPositions", () => {
  it("returns the saved positions for a graph", async () => {
    stubFetch(
      jsonResponse({
        positions: [{ node_iri: NODE_IRI, position_x: 10, position_y: 20, locked: false }],
      })
    );

    const positions = await fetchLayoutPositions("g1");

    expect(fetch).toHaveBeenCalledWith("/api/proxy/layout-positions?graph_id=g1");
    expect(positions).toEqual([{ node_iri: NODE_IRI, position_x: 10, position_y: 20, locked: false }]);
  });

  // Non-fatal by design: a down layout-persistence backend must never block
  // the core Explorer canvas from rendering (that data comes from a wholly
  // separate CE-READ-1 fetch) -- so this degrades to "no saved layout"
  // instead of throwing, unlike fetchGraph/fetchPalette's CeReadError.
  it("degrades to an empty list when the response is not ok", async () => {
    stubFetch(new Response("nope", { status: 503 }));

    const positions = await fetchLayoutPositions("g1");

    expect(positions).toEqual([]);
  });

  it("degrades to an empty list when the fetch itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const positions = await fetchLayoutPositions("g1");

    expect(positions).toEqual([]);
  });
});

describe("saveLayoutPosition", () => {
  it("POSTs the graph/node/position to the proxy route", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await saveLayoutPosition("g1", NODE_IRI, 10, 20);

    expect(fetch).toHaveBeenCalledWith(
      "/api/proxy/layout-positions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph_id: "g1", node_iri: NODE_IRI, position_x: 10, position_y: 20 }),
      })
    );
  });

  it("throws when the save fails, so the caller's retry loop can react", async () => {
    stubFetch(new Response("nope", { status: 500 }));

    await expect(saveLayoutPosition("g1", NODE_IRI, 10, 20)).rejects.toThrow();
  });
});

describe("resetLayoutPositions", () => {
  it("DELETEs the graph's saved positions via the proxy route", async () => {
    stubFetch(new Response(null, { status: 204 }));

    await resetLayoutPositions("g1");

    expect(fetch).toHaveBeenCalledWith("/api/proxy/layout-positions?graph_id=g1", expect.objectContaining({ method: "DELETE" }));
  });

  it("throws when the reset fails", async () => {
    stubFetch(new Response("nope", { status: 500 }));

    await expect(resetLayoutPositions("g1")).rejects.toThrow();
  });
});

describe("applySavedPositions", () => {
  it("merges a saved position onto the matching element, leaving others untouched", () => {
    const elements: CytoscapeElement[] = [{ data: { id: NODE_IRI } }, { data: { id: "urn:weave:x:2" } }];
    const saved = [{ node_iri: NODE_IRI, position_x: 10, position_y: 20, locked: false }];

    const result = applySavedPositions(elements, saved);

    expect(result[0]).toEqual({ data: { id: NODE_IRI }, position: { x: 10, y: 20 } });
    expect(result[1]).toEqual({ data: { id: "urn:weave:x:2" } });
  });

  it("returns the same array reference when there are no saved positions (no-op fast path)", () => {
    const elements: CytoscapeElement[] = [{ data: { id: NODE_IRI } }];

    expect(applySavedPositions(elements, [])).toBe(elements);
  });
});
