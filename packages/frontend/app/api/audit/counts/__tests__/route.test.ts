import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// getSessionClaims decodes the real JWT payload, so the mocked session
// carries a fake (unsigned) token with a tenant_id claim.
const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", sub: "admin" })
).toString("base64url")}.sig`;

function makeRequest(query = ""): NextRequest {
  const suffix = query ? `?${query}` : "";
  return new NextRequest(`http://localhost:3000/api/audit/counts${suffix}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("GET /api/audit/counts", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ counts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("injects the session tenant_id and proxies the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);

    const response = await GET(makeRequest("date_from=2026-07-01&date_to=2026-07-19"));

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/audit/counts?");
    expect(url).toContain("tenant_id=tenant-1");
    expect(url).toContain("date_from=2026-07-01");
    expect(url).toContain("date_to=2026-07-19");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ counts: [] });
  });

  it("passes through the upstream 403 for a non-admin caller", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
