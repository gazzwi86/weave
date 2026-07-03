import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/search?${query}`);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 }))
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
});
