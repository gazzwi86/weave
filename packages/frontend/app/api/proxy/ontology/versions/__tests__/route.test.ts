import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";

const BACKEND_BODY = {
  versions: [
    {
      version_iri: "urn:workspace:demo:v1",
      semver: "0.1.0",
      status: "published",
      created_at: "2026-07-01T10:00:00Z",
      published_at: "2026-07-01T10:05:00Z",
      actor_iri: "urn:weave:user:client",
    },
  ],
  total: 1,
  page: 1,
  per_page: 50,
};

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/ontology/versions?${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("GET /api/proxy/ontology/versions", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET(makeRequest("page=1&per_page=50"));

    expect(response.status).toBe(401);
  });

  it("forwards page/per_page and the bearer token, unwraps the envelope to a bare versions array", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify(BACKEND_BODY), { status: 200, headers: { "content-type": "application/json" } })
    );

    const response = await GET(makeRequest("page=2&per_page=10"));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("/api/ontology/versions?");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("per_page=10");
    expect(options.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(BACKEND_BODY.versions);
  });

  it("omits page/per_page from the upstream URL when the caller doesn't supply them", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify(BACKEND_BODY), { status: 200, headers: { "content-type": "application/json" } })
    );

    await GET(makeRequest(""));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(calledUrl).not.toContain("page=");
    expect(calledUrl).not.toContain("per_page=");
  });

  it("passes through an upstream error status/body unchanged", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify({ error: "no_active_workspace" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest("page=1&per_page=50"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "no_active_workspace" });
  });

  it("returns 503 when the ontology store is unreachable", async () => {
    mockAuthedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest("page=1&per_page=50"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
