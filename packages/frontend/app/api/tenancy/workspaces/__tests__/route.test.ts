import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

/** Real-shaped JWT so getSessionClaims can decode the tenant claim -- the
 * tenant id is derived server-side from this token, never from the client. */
const ADMIN_TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const WORKSPACE = {
  id: "ws-1",
  slug: "ops",
  display_name: "Operations",
  named_graph_iri: "https://weave.example/graphs/ws-1",
  created_at: "2026-07-01T00:00:00Z",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/tenancy/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

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

describe("/api/tenancy/workspaces", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch([], 200);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET returns 401 when the token carries no tenant claim", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "not-a-jwt" } as never);
    stubFetch([], 200);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the token's tenant and proxies the list", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch([WORKSPACE], 200);

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tenants/tenant-1/workspaces"),
      expect.objectContaining({ headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([WORKSPACE]);
  });

  it("GET returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });

  it("POST rejects an invalid slug without calling the backend (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch(WORKSPACE, 201);

    const response = await POST(makeRequest({ slug: "-Bad Slug-", display_name: "Ops" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POST forwards the body and proxies a 201", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch(WORKSPACE, 201);

    const response = await POST(makeRequest({ slug: "ops", display_name: "Operations" }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tenants/tenant-1/workspaces"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "ops", display_name: "Operations" }),
      })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(WORKSPACE);
  });

  it("POST passes the 409 slug-taken response through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch({ detail: { error: "workspace_slug_taken" } }, 409);

    const response = await POST(makeRequest({ slug: "ops", display_name: "Operations" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ detail: { error: "workspace_slug_taken" } });
  });
});
