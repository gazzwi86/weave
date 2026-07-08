import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

/** Real-shaped JWT so getSessionClaims can decode the tenant claim -- the
 * scope IRI is derived server-side from this token, never from the client. */
const ADMIN_TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/billing/caps", {
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

describe("/api/billing/caps", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);

    const response = await PUT(makeRequest({ value_usd: 50 }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount without calling the backend (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch({}, 200);

    const response = await PUT(makeRequest({ value_usd: 0 }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("builds the company-wide scope IRI when no workspace_id is given", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch({ scope_iri: "urn:weave:tenant:tenant-1:company", value_usd: 50 }, 200);

    const response = await PUT(makeRequest({ value_usd: 50 }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/billing/caps"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ scope_iri: "urn:weave:tenant:tenant-1:company", value_usd: 50 }),
      })
    );
    expect(response.status).toBe(200);
  });

  it("builds the per-workspace scope IRI and passes a 422 through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    stubFetch({ detail: { error: "cap_exceeds_parent", parent_cap_usd: 100 } }, 422);

    const response = await PUT(makeRequest({ value_usd: 500, workspace_id: "ws-1" }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/billing/caps"),
      expect.objectContaining({
        body: JSON.stringify({ scope_iri: "urn:weave:tenant:tenant-1:ws:ws-1", value_usd: 500 }),
      })
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      detail: { error: "cap_exceeds_parent", parent_cap_usd: 100 },
    });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ADMIN_TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await PUT(makeRequest({ value_usd: 50 }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
