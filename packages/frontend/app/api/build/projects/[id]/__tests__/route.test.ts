import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const PROJECT = {
  project_iri: "urn:weave:project:p-1",
  name: "Ledger Sync",
  pinned_graph_version_iri: "urn:weave:graph:v-1",
  created_at: "2026-07-01T00:00:00Z",
  repo: null,
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

describe("/api/build/projects/[id]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(PROJECT, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards to the single-project read (AC-9 sidebar name lookup)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(PROJECT, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PROJECT);
  });

  it("passes a 404 not_found response through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "not_found" }, 404);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
