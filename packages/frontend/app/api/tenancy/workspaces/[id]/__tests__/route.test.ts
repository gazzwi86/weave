import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { PUT } from "../route";

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
  description: "Ships the platform.",
  created_at: "2026-07-01T00:00:00Z",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/tenancy/workspaces/ws-1", {
    method: "PUT",
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

describe("/api/tenancy/workspaces/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("PUT returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(WORKSPACE, 200);

    const response = await PUT(makeRequest({ description: "x" }), { params: Promise.resolve({ id: "ws-1" }) });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT rejects a description over 2000 chars without calling the backend (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch(WORKSPACE, 200);

    const response = await PUT(
      makeRequest({ description: "x".repeat(2001) }),
      { params: Promise.resolve({ id: "ws-1" }) }
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT forwards to the token's tenant and workspace id, proxying the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch(WORKSPACE, 200);

    const response = await PUT(
      makeRequest({ description: "Ships the platform." }),
      { params: Promise.resolve({ id: "ws-1" }) }
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tenants/tenant-1/workspaces/ws-1"),
      expect.objectContaining({
        method: "PUT",
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Ships the platform." }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(WORKSPACE);
  });

  it("PUT passes the 404 workspace_not_found response through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch({ detail: { error: "workspace_not_found" } }, 404);

    const response = await PUT(
      makeRequest({ description: "x" }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: { error: "workspace_not_found" } });
  });
});
