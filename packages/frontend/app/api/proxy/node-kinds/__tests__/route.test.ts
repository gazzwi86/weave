import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("GET /api/proxy/node-kinds", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("forwards the caller's bearer token to CE-READ-1 and proxies the palette", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/node-kinds"),
      expect.objectContaining({ headers: { Authorization: "Bearer token-abc" } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }],
    });
  });

  it("returns a distinguishable error when CE-READ-1 is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "store_unavailable" });
  });
});
