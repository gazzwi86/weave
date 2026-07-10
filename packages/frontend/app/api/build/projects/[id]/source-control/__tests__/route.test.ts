import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const CONFIG = {
  provider: "github",
  token_secret_ref: "weave/tenant-1/scm/acme/github/token",
  configured_by: "urn:weave:principal:user:admin",
  configured_at: "2026-07-01T00:00:00Z",
};

const SENTINEL_TOKEN_VALUE = "ghp_should-never-be-forwarded-back-9f2c1a";

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

function putRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/source-control", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/source-control", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(CONFIG, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the backend (no role guard on reads)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONFIG, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/source-control"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CONFIG);
  });

  it("GET passes a 404 (unconfigured) response through as-is (AC-5)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "not_found" }, 404);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(response.status).toBe(404);
  });

  it("PUT returns 400 on a bad provider (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONFIG, 200);
    const response = await PUT(
      putRequest({ provider: "bitbucket", token: SENTINEL_TOKEN_VALUE }),
      params()
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT returns 400 on an empty token (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONFIG, 200);
    const response = await PUT(putRequest({ provider: "github", token: "" }), params());
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT forwards provider+token and never echoes the token in the response", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONFIG, 200);
    const response = await PUT(
      putRequest({ provider: "github", token: SENTINEL_TOKEN_VALUE }),
      params()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/source-control"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ provider: "github", token: SENTINEL_TOKEN_VALUE }),
      })
    );
    expect(response.status).toBe(200);
    const responseText = JSON.stringify(await response.json());
    expect(responseText).not.toContain(SENTINEL_TOKEN_VALUE);
  });

  it("PUT passes a 403 forbidden response through as-is (non-admin denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "settings" }, 403);
    const response = await PUT(
      putRequest({ provider: "github", token: SENTINEL_TOKEN_VALUE }),
      params()
    );
    expect(response.status).toBe(403);
  });
});
