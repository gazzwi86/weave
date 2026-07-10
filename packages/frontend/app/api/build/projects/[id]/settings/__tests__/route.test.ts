import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PATCH } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "editor" })
).toString("base64url")}.sig`;

const SETTINGS = {
  model_tier: "mid",
  model_tier_source: "company",
  cost_cap_usd: 50,
  cost_cap_source: "company",
};

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
    )
  );
}

function params(id = "p-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/settings", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(SETTINGS, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the settings read (no role guard on reads)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(SETTINGS, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/settings"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SETTINGS);
  });

  it("PATCH returns 400 on an empty body (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(SETTINGS, 200);
    const response = await PATCH(patchRequest({ model_tier: 123 }), params());
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PATCH passes AC-3's cap_looser_than_parent 422 through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(
      { error: "cap_looser_than_parent", level: "company", parent_cap_usd: 25 },
      422
    );
    const response = await PATCH(patchRequest({ cost_cap_usd: 100 }), params());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "cap_looser_than_parent",
      level: "company",
      parent_cap_usd: 25,
    });
  });

  it("PATCH passes the 503 project_scope_settings_unavailable failure through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "project_scope_settings_unavailable" }, 503);
    const response = await PATCH(patchRequest({ model_tier: "high" }), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "project_scope_settings_unavailable" });
  });

  it("PATCH passes a 403 forbidden response through as-is (editor denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "settings" }, 403);
    const response = await PATCH(patchRequest({ model_tier: "high" }), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "settings" });
  });
});
