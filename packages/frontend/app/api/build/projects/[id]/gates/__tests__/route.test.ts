import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

// Shape lifted from packages/backend/src/weave_backend/schemas/gates.py
// (PendingGatesResponse) -- see test_gates_pending_router.py.
const GATES = {
  project_iri: "p-1",
  gates: [
    {
      task_id: "t-1",
      gate: "hitl",
      evidence: {
        task_detail: "/api/projects/p-1/tasks/t-1",
        audit: "/api/projects/p-1/tasks/t-1/audit",
        console_log: "/api/projects/p-1/tasks/t-1/console-log",
        captures: "/api/projects/p-1/tasks/t-1/captures",
        hitl_action: "/api/tasks/t-1/hitl",
      },
    },
  ],
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

describe("/api/build/projects/[id]/gates", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("GET returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(GATES, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET forwards to the pending-gates read with status=pending (G12)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(GATES, 200);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params("p-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/gates?status=pending"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(GATES);
  });

  it("GET passes a 404 not_found failure through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "not_found" }, 404);
    const response = await GET(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
