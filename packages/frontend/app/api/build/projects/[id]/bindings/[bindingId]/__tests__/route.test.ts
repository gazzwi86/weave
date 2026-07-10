import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

function params(id = "p-1", bindingId = "b-1"): { params: Promise<{ id: string; bindingId: string }> } {
  return { params: Promise.resolve({ id, bindingId }) };
}

describe("/api/build/projects/[id]/bindings/[bindingId]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("DELETE returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.stubGlobal("fetch", vi.fn());
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("DELETE removes a binding, forwarded to the backend (AC-5, admin-only server-side)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params("p-1", "b-1"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/bindings/b-1"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(response.status).toBe(204);
  });

  it("DELETE passes a 403 forbidden response through as-is (non-admin denied)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "forbidden", action: "bindings" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          })
      )
    );
    const response = await DELETE(new NextRequest("http://localhost:3000/x"), params());
    expect(response.status).toBe(403);
  });
});
