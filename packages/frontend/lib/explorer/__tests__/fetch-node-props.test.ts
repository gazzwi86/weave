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
      },
    });
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
