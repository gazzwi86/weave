import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

const DIFF = {
  from_version_iri: "urn:weave:version:v1",
  to_version_iri: "urn:weave:version:v2",
  added: [{ subject: "s", predicate: "p", object: "o" }],
  removed: [],
  modified: [],
  versions: [{ version_iri: "urn:weave:version:v2", breaking: true }],
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

describe("/api/build/projects/[id]/pin-diff", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(DIFF, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the pin-diff read (no role guard on reads)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(DIFF, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/pin-diff"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DIFF);
  });

  it("GET passes the 503 diff_unavailable failure through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "diff_unavailable" }, 503);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "diff_unavailable" });
  });

  it("GET passes a 404 not_found failure through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "not_found" }, 404);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
