import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchNodeProps } from "../fetch-node-props";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const IRI = "https://weave.example/entity/cust-onboarding";

describe("fetchNodeProps", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-2 + brief's integration test: "should call CE-READ-1
  // /api/ontology/resource/{iri} ... and return label, type, key_properties".
  it("fetches the proxy route for the given IRI and returns the parsed properties", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        label: "Customer Onboarding",
        type_label: "Process",
        bpmo_kind: "Process",
        key_properties: [{ path: "rdfs:comment", label: "Description", value: "…" }],
        raw_iri: null,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNodeProps(IRI, 10_000);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/proxy/ontology/resource/${encodeURIComponent(IRI)}`,
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(result).toEqual({
      type: "ok",
      data: {
        label: "Customer Onboarding",
        typeLabel: "Process",
        bpmoKind: "Process",
        keyProperties: [{ path: "rdfs:comment", label: "Description", value: "…" }],
        rawIri: null,
        neighbours: [],
      },
    });
  });

  // TASK-005 AC-3: neighbour expansion reuses this same fetch (no second
  // CE-READ-1 round trip) -- the response's `neighbours` field is mapped
  // through alongside the rest of the node's properties.
  it("maps the response's neighbours field through to camelCase", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          label: "Customer Onboarding",
          type_label: "Process",
          key_properties: [],
          raw_iri: null,
          neighbours: [
            {
              iri: "https://weave.example/entity/invoice-1",
              label: "Invoice 1",
              bpmo_kind: "DataAsset",
              edge_predicate: "https://weave.example/ontology/bpmo#relatesTo",
              edge_direction: "outgoing",
            },
          ],
        })
      )
    );

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result.type).toBe("ok");
    expect(result.type === "ok" && result.data.neighbours).toEqual([
      {
        iri: "https://weave.example/entity/invoice-1",
        label: "Invoice 1",
        bpmoKind: "DataAsset",
        edgePredicate: "https://weave.example/ontology/bpmo#relatesTo",
        edgeDirection: "outgoing",
      },
    ]);
  });

  it("defaults neighbours to an empty list when the response omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ label: "L", type_label: "T", key_properties: [], raw_iri: null }))
    );

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result.type === "ok" && result.data.neighbours).toEqual([]);
  });

  it("returns a 404 error result without ever exposing the response body (AC-8)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "not_found" }, 404)));

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result).toEqual({ type: "error", status: 404 });
  });

  it("returns a 401 error result when unauthorised", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "unauthorised" }, 401)));

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result).toEqual({ type: "error", status: 401 });
  });

  it("returns a 503 error result when CE-READ-1 is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "store_unavailable" }, 503)));

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result).toEqual({ type: "error", status: 503 });
  });

  // AC-3: a timeout must resolve to the same shape as any other failure, not
  // throw and crash the caller.
  it("returns a network-error result (status 0) instead of throwing when the fetch itself rejects/aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      })
    );

    const result = await fetchNodeProps(IRI, 10_000);

    expect(result).toEqual({ type: "error", status: 0 });
  });

  it("returns a 422 error result for a non-absolute IRI without ever making a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNodeProps("not-an-iri", 10_000);

    expect(result).toEqual({ type: "error", status: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
