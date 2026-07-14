import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "test-token";

function stubFetch(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify({ detail: "not found" }), {
            status,
            headers: { "content-type": "application/json" },
          })
    )
  );
}

function params(id = "w-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function deleteRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/widgets/w-1", { method: "DELETE" });
}

describe("DELETE /api/dashboard/widgets/[id] (unpin)", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(204);

    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the delete to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(204);

    const response = await DELETE(deleteRequest(), params("w-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets/w-1"),
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(204);
  });

  it("passes a 404 (not found / not owner) through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(404);

    const response = await DELETE(deleteRequest(), params());

    expect(response.status).toBe(404);
  });
});
