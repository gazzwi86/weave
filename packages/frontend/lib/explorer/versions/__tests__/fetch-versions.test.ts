import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchVersions } from "../fetch-versions";

function stubFetch(response: Response | (() => never)): void {
  vi.stubGlobal("fetch", vi.fn(typeof response === "function" ? response : async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// AC-1: lists published versions via CE-VERSION-1's proxy route.
describe("fetchVersions", () => {
  it("should list versions from CE-VERSION-1 stub with latest marker", async () => {
    const rows = [
      { version_iri: "urn:v1", semver: "1.0.0", published_at: "2026-01-01T00:00:00Z", is_latest: false },
      { version_iri: "urn:v2", semver: "1.1.0", published_at: "2026-02-01T00:00:00Z", is_latest: true },
    ];
    stubFetch(new Response(JSON.stringify(rows), { status: 200 }));

    const result = await fetchVersions(5000);

    expect(result).toEqual({ type: "ok", versions: rows });
  });

  it("never throws on an HTTP error -- resolves to a typed error", async () => {
    stubFetch(new Response(JSON.stringify({ error: "store_unavailable" }), { status: 503 }));

    const result = await fetchVersions(5000);

    expect(result).toEqual({ type: "error", status: 503 });
  });

  it("never throws on a network failure -- resolves to a typed error", async () => {
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });

    const result = await fetchVersions(5000);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
