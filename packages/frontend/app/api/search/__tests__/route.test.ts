import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/search?${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ results: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(makeRequest("q=ac"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a query longer than 200 characters (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(makeRequest(`q=${"a".repeat(201)}`));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards q to the backend with a bearer token and proxies the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(makeRequest("q=acme"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search?q=acme"),
      expect.objectContaining({
        headers: { Authorization: "Bearer token-abc" },
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [], total: 0 });
  });

  // PR #13 finding (4): a gateway-down 502 with an HTML (non-JSON) body used
  // to blow up on the unconditional `.json()` call -- must come back as a
  // distinguishable error, not crash or silently proxy garbage.
  it("returns a distinguishable error when upstream returns a non-JSON body", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    const response = await GET(makeRequest("q=acme"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest("q=acme"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
