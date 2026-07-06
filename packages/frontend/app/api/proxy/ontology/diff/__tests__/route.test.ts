import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";
const FROM = "latest";
const TO = "urn:workspace:demo:v2";

const DIFF_BODY = {
  added: [{ subject: "urn:a", predicate: "urn:rel", object: "urn:b" }],
  removed: [],
  modified: [],
};

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/ontology/diff?${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

describe("GET /api/proxy/ontology/diff -- auth and validation", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET(makeRequest(`from=${FROM}&to=${TO}`));

    expect(response.status).toBe(401);
  });

  it("returns 400 when from or to is missing (Law 13)", async () => {
    mockAuthedSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const missingTo = await GET(makeRequest(`from=${FROM}`));
    const missingFrom = await GET(makeRequest(`to=${TO}`));

    expect(missingTo.status).toBe(400);
    expect(missingFrom.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/proxy/ontology/diff -- forwarding and status passthrough", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    mockAuthedSession();
  });

  it("forwards from/to and the bearer token, returns the diff body", async () => {
    stubFetch(
      new Response(JSON.stringify(DIFF_BODY), { status: 200, headers: { "content-type": "application/json" } })
    );

    const response = await GET(makeRequest(`from=${FROM}&to=${encodeURIComponent(TO)}`));

    const [calledUrl, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain(`from=${FROM}`);
    expect(calledUrl).toContain(`to=${encodeURIComponent(TO)}`);
    expect(options.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DIFF_BODY);
  });

  it("passes through a 404 when there is no baseline to diff against", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "version_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest(`from=${FROM}&to=${encodeURIComponent(TO)}`));

    expect(response.status).toBe(404);
  });

  it("returns 503 when the ontology store is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest(`from=${FROM}&to=${encodeURIComponent(TO)}`));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
