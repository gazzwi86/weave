import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PUT } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const CONTRIBUTOR = {
  principal_iri: "urn:weave:principal:user:client",
  role: "editor",
  added_by: "urn:weave:principal:user:admin",
  added_at: "2026-07-01T00:00:00Z",
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
  return new NextRequest("http://localhost:3000/api/build/projects/p-1/contributors", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("/api/build/projects/[id]/contributors", () => {
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

  it("GET forwards to the contributors list (no role guard on reads)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ items: [CONTRIBUTOR] }, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/contributors"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [CONTRIBUTOR] });
  });

  it("PUT returns 400 on a bad role (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONTRIBUTOR, 200);
    const response = await PUT(
      putRequest({ principal_iri: "urn:weave:principal:user:client", role: "owner" }),
      params()
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PUT adds a contributor", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(CONTRIBUTOR, 200);
    const response = await PUT(
      putRequest({ principal_iri: "urn:weave:principal:user:client", role: "editor" }),
      params()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/projects/p-1/contributors/urn%3Aweave%3Aprincipal%3Auser%3Aclient"
      ),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ role: "editor" }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(CONTRIBUTOR);
  });

  it("PUT passes a 403 forbidden response through as-is (editor denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "forbidden", action: "contributors" }, 403);
    const response = await PUT(
      putRequest({ principal_iri: "urn:weave:principal:user:client", role: "editor" }),
      params()
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", action: "contributors" });
  });
});
