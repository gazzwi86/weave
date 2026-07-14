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

function params(id = "w-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/widgets/w-1/pin", { method: "POST" });
}

describe("POST /api/dashboard/widgets/[id]/pin", () => {
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

  it("forwards the pin request to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ id: "w-1", suggested: false }, 200);

    const response = await POST(postRequest(), params("w-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets/w-1/pin"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(200);
  });

  it("passes a 404 (not found / not owner) through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ detail: "not found" }, 404);

    const response = await POST(postRequest(), params());

    expect(response.status).toBe(404);
  });
});
