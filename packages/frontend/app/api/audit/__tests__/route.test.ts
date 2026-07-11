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
  return new NextRequest(`http://localhost:3000/api/audit${suffix}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("GET /api/audit", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ entries: [], total: 0, page: 1, per_page: 50 }), {
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

  it("returns 400 for an invalid page (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);

    const response = await GET(makeRequest("page=0"));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("injects the session tenant_id and proxies the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);

    const response = await GET(makeRequest("page=2&per_page=50&event_type=workspace.created"));

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/audit?");
    expect(url).toContain("tenant_id=tenant-1");
    expect(url).toContain("page=2");
    expect(url).toContain("event_type=workspace.created");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: `Bearer ${TOKEN}` } })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [], total: 0, page: 1, per_page: 50 });
  });

  it("forwards all seven PLAT-AUDIT-1 filter dimensions to the backend, not just event_type", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);

    const response = await GET(
      makeRequest(
        [
          "engine=build",
          "event_type=workspace.created",
          "actor_principal_iri=urn:weave:principal:tenant-1:human:alice",
          "target_iri=urn:weave:workspace:tenant-1:ws-1",
          "date_from=2026-01-01T00:00:00Z",
          "date_to=2026-12-31T23:59:59Z",
          "q=onboarding",
        ].join("&")
      )
    );

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("engine=build");
    expect(url).toContain("actor_principal_iri=urn%3Aweave%3Aprincipal%3Atenant-1%3Ahuman%3Aalice");
    expect(url).toContain("target_iri=urn%3Aweave%3Aworkspace%3Atenant-1%3Aws-1");
    expect(url).toContain("date_from=2026-01-01T00%3A00%3A00Z");
    expect(url).toContain("date_to=2026-12-31T23%3A59%3A59Z");
    expect(url).toContain("q=onboarding");
    expect(response.status).toBe(200);
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
