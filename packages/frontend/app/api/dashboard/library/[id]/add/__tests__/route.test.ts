import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "test-token";

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

function params(id = "lib-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/library/lib-1/add", { method: "POST" });
}

describe("POST /api/dashboard/library/[id]/add", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);

    const response = await POST(postRequest(), params());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the add request to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ id: "w-2" }, 201);

    const response = await POST(postRequest(), params("lib-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/library/lib-1/add"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(201);
  });

  it("passes a 404 through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ detail: "not found" }, 404);

    const response = await POST(postRequest(), params());

    expect(response.status).toBe(404);
  });
});
