import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/notifications/n-1/read", { method: "POST" });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/notifications/[id]/read", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ id: "n-1", read: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest(), params("n-1"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the notification id to the backend with a bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest(), params("n-1"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/notifications/n-1/read"),
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token-abc" },
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "n-1", read: true });
  });

  // Law 13: the path param is untrusted input, validated via zod.
  it("returns 400 for an empty id", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest(), params(""));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("propagates a 404 from the backend when the notification doesn't exist", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch(
      new Response(JSON.stringify({ error: "notification_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await POST(makeRequest(), params("missing"));

    expect(response.status).toBe(404);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makeRequest(), params("n-1"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
