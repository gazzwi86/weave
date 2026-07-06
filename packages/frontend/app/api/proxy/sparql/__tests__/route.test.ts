import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/sparql?${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const TOKEN = "token-abc";
const LATEST_PAGE_ZERO_QUERY = "version=latest&page=0";

// CE-READ-1's own SPARQL-JSON binding shape (routers/sparql.py's raw
// `query=` path -- see route.ts's BackendSparqlResponse).
const BACKEND_PAGE_ONE = {
  version_iri: "urn:workspace:demo:v1",
  page: 1,
  head: { vars: ["subject", "predicate", "object"] },
  results: {
    bindings: [
      {
        subject: { value: "urn:a" },
        predicate: { value: "urn:rel" },
        object: { value: "urn:b" },
      },
    ],
  },
};

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("GET /api/proxy/sparql -- auth and validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(BACKEND_PAGE_ONE), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET(makeRequest(LATEST_PAGE_ZERO_QUERY));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when version is not 'latest' or page is not a non-negative integer (Law 13)", async () => {
    mockAuthedSession();

    const badVersion = await GET(makeRequest("version=v1&page=0"));
    const badPage = await GET(makeRequest("version=latest&page=-1"));

    expect(badVersion.status).toBe(400);
    expect(badPage.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("GET /api/proxy/sparql -- adapts CE-READ-1 into the Explorer's SparqlPage shape", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(BACKEND_PAGE_ONE), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("translates the client's 0-indexed page to CE-READ-1's 1-indexed page, injects the default graph query, and shapes the response", async () => {
    mockAuthedSession();

    const response = await GET(makeRequest(LATEST_PAGE_ZERO_QUERY));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(calledUrl).toContain("/api/sparql?");
    expect(calledUrl).toContain("version=latest");
    expect(calledUrl).toContain("page=1"); // 0 (client) -> 1 (CE-READ-1)
    expect(calledUrl).toContain(encodeURIComponent("GRAPH"));
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rows: [{ subject: "urn:a", predicate: "urn:rel", object: "urn:b" }],
      columns: ["subject", "predicate", "object"],
      has_more_pages: false,
      page: 0,
    });
  });

  it("reports has_more_pages true only when CE-READ-1 sets a Link header", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify(BACKEND_PAGE_ONE), {
        status: 200,
        headers: {
          "content-type": "application/json",
          Link: '</api/sparql?query=x&version=latest&page=2>; rel="next"',
        },
      })
    );

    const response = await GET(makeRequest(LATEST_PAGE_ZERO_QUERY));

    expect((await response.json()).has_more_pages).toBe(true);
  });

  // AC-9: only version/page ever reach CE-READ-1 -- an attempted `graph=`
  // (or `query=`) override in the client request is never forwarded; the
  // query text is always the fixed server-side constant.
  it("ignores an attempted graph= override -- only version/page/the fixed query ever reach CE-READ-1", async () => {
    mockAuthedSession();

    await GET(makeRequest("version=latest&page=0&graph=tenant-b"));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(calledUrl).not.toContain("graph=");
    expect(calledUrl).toContain("version=latest&page=1");
  });

  it("returns a distinguishable error when CE-READ-1 is unreachable", async () => {
    mockAuthedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest(LATEST_PAGE_ZERO_QUERY));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });

  it("passes through a CE-READ-1 error body/status unchanged (e.g. no_active_workspace)", async () => {
    mockAuthedSession();
    stubFetch(
      new Response(JSON.stringify({ error: "no_active_workspace" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest(LATEST_PAGE_ZERO_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "no_active_workspace" });
  });
});
