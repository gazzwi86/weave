import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchLayerNodes } from "../fetch-layer-nodes";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const KIND_IRI = "https://weave.io/ontology/Concept";

describe("fetchLayerNodes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-6 integration: "should load governed-content layer nodes via CE-READ-1".
  it("POSTs the layer's kind query and maps rows into node elements", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        rows: [{ subject: "https://weave.io/entity/glossary-term-1", label: "Revenue" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLayerNodes(KIND_IRI, undefined, 10_000);

    expect(fetchMock).toHaveBeenCalledWith("/api/proxy/sparql", expect.objectContaining({ method: "POST" }));
    expect(result).toEqual({
      type: "ok",
      elements: [{ data: { id: "https://weave.io/entity/glossary-term-1", label: "Revenue", bpmo_kind: undefined } }],
    });
  });

  // AC-6 integration 2: governance layer's governedBy edges become elements too.
  it("adds a governedBy edge and its target node when a row carries governed_object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          rows: [
            {
              subject: "https://weave.io/entity/policy-1",
              label: "Data Retention",
              governed_object: "https://weave.io/entity/dataset-1",
            },
          ],
        })
      )
    );

    const result = await fetchLayerNodes(KIND_IRI, "https://weave.io/ontology/governedBy", 10_000);

    expect(result.type).toBe("ok");
    const elements = result.type === "ok" ? result.elements : [];
    expect(elements).toContainEqual({ data: { id: "https://weave.io/entity/policy-1", label: "Data Retention", bpmo_kind: undefined } });
    expect(elements).toContainEqual({ data: { id: "https://weave.io/entity/dataset-1", label: "dataset-1", bpmo_kind: undefined } });
    expect(elements).toContainEqual({
      data: {
        id: "https://weave.io/entity/policy-1|governedBy|https://weave.io/entity/dataset-1",
        source: "https://weave.io/entity/policy-1",
        target: "https://weave.io/entity/dataset-1",
        label: "governedBy",
      },
    });
  });

  // AC-6: "if layer empty then disable toggle" -- empty rows, not an error.
  it("returns empty when the layer has no members", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ rows: [] })));

    const result = await fetchLayerNodes(KIND_IRI, undefined, 10_000);

    expect(result).toEqual({ type: "empty" });
  });

  // AC-6: tenant has no configured kind for this layer (e.g. no brand
  // individuals) -- short-circuits to empty without a network call.
  it("returns empty without calling fetch when kindIri is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLayerNodes("", undefined, 10_000);

    expect(result).toEqual({ type: "empty" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an error result on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "store_unavailable" }, 503)));

    const result = await fetchLayerNodes(KIND_IRI, undefined, 10_000);

    expect(result).toEqual({ type: "error", status: 503 });
  });

  it("returns a network-error result (status 0) instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      })
    );

    const result = await fetchLayerNodes(KIND_IRI, undefined, 10_000);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
