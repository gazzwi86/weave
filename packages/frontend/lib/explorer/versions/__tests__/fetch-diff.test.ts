import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDiff } from "../fetch-diff";

function stubFetch(response: Response | (() => never)): void {
  vi.stubGlobal("fetch", vi.fn(typeof response === "function" ? response : async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDiff", () => {
  // AC-3: calls CE-DIFF-1's proxy route with from/to.
  it("fetches the diff and forwards from/to as query params", async () => {
    const body = { added: [], removed: [], modified: [] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDiff("urn:v1", "urn:v2", 5000);

    expect(result).toEqual({ type: "ok", diff: body });
    expect(fetchMock.mock.calls.at(0)?.at(0)).toBe("/api/proxy/ontology/diff?from=urn%3Av1&to=urn%3Av2");
  });

  // AC-5: an error response resolves to a typed error, never throws.
  it("never throws on an HTTP error -- resolves to a typed error", async () => {
    stubFetch(new Response(JSON.stringify({ error: "unauthorised" }), { status: 401 }));

    const result = await fetchDiff("urn:v1", "urn:v2", 5000);

    expect(result).toEqual({ type: "error", status: 401 });
  });

  // AC-5: a network failure / timeout resolves to a typed error too.
  it("never throws on a network failure or timeout -- resolves to a typed error", async () => {
    stubFetch(() => {
      throw new Error("timeout");
    });

    const result = await fetchDiff("urn:v1", "urn:v2", 5000);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
