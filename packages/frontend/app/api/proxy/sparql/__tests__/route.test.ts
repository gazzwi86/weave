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
const PAGE_ZERO = {
  rows: [{ subject: "urn:a", predicate: "urn:rel", object: "urn:b", bpmo_kind: "Process" }],
  columns: ["subject", "predicate", "object", "bpmo_kind"],
  has_more_pages: false,
  page: 0,
};

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("GET /api/proxy/sparql -- auth and validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(PAGE_ZERO), {
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

describe("GET /api/proxy/sparql -- forwarding and errors", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify(PAGE_ZERO), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("forwards version/page and the bearer token, and proxies the CE-READ-1 page", async () => {
    mockAuthedSession();

    const response = await GET(makeRequest("version=latest&page=2"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sparql?version=latest&page=2"),
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PAGE_ZERO);
  });

  // AC-9: even if a caller tries to sneak a `graph=` override into the
  // querystring, the schema only ever reads version/page -- there is no
  // code path that can forward a graph= parameter to CE-READ-1.
  it("ignores an attempted graph= override -- only version/page ever reach CE-READ-1 (cross-tenant isolation)", async () => {
    mockAuthedSession();

    await GET(makeRequest("version=latest&page=0&graph=tenant-b"));

    const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(calledUrl).not.toContain("graph=");
    expect(calledUrl).toContain(LATEST_PAGE_ZERO_QUERY);
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
});
