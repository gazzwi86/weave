import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "editor" })
).toString("base64url")}.sig`;

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

describe("/api/build/projects/[id]/state", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ phase: "running" }, 200);

    const response = await GET(new NextRequest("http://localhost:3000/x"), params());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the run-status channel (AC-4)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    const state = { project_iri: "p-1", phase: "running", dispatch_count: 1, tasks: [] };
    stubFetch(state, 200);

    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/state/p-1"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(state);
  });

  it("passes a 404 (no run yet) through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "not_found" }, 404);

    const response = await GET(new NextRequest("http://localhost:3000/x"), params());

    expect(response.status).toBe(404);
  });
});
