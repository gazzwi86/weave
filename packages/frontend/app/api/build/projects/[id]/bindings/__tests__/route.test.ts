import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const BINDING = {
  binding_id: "b-1",
  system: "jira",
  connector_ref: "jira-1",
  space_ref: "ACME",
  created_by: "urn:weave:principal:user:admin",
  created_at: "2026-07-01T00:00:00Z",
  health: { status: "ok", last_sync: null, last_error: null, error_count: 0, skipped_count: 0 },
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

function putRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/bindings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/bindings", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ items: [] }, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the bindings list (no role guard on reads, AC-1)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ items: [BINDING] }, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/bindings"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [BINDING] });
  });

  it("PUT returns 400 on a bad system (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(BINDING, 201);
    const response = await PUT(
      putRequest({ system: "sharepoint", connector_ref: "jira-1", space_ref: "ACME" }),
      params()
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT binds a jira space", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(BINDING, 201);
    const response = await PUT(
      putRequest({ system: "jira", connector_ref: "jira-1", space_ref: "ACME" }),
      params()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/bindings"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ system: "jira", connector_ref: "jira-1", space_ref: "ACME" }),
      })
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(BINDING);
  });

  it("PUT passes a 403 forbidden response through as-is (non-admin denied, AC-5)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "bindings" }, 403);
    const response = await PUT(
      putRequest({ system: "jira", connector_ref: "jira-1", space_ref: "ACME" }),
      params()
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "bindings" });
  });

  it("PUT passes a 409 duplicate-binding conflict through as-is (AC-4)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "duplicate_binding", system: "jira", space_ref: "ACME" }, 409);
    const response = await PUT(
      putRequest({ system: "jira", connector_ref: "jira-1", space_ref: "ACME" }),
      params()
    );
    expect(response.status).toBe(409);
  });
});
