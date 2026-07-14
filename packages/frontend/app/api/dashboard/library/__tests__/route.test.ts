import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, POST } from "../route";

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

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/library", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/dashboard/library", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);

    const response = await POST(postRequest({ widget_id: "w-1", name: "n" }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a body missing required fields", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({}, 200);

    const response = await POST(postRequest({ widget_id: "w-1" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid publish request to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ id: "lib-1", name: "n" }, 201);

    const response = await POST(postRequest({ widget_id: "w-1", name: "n", description: "d" }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/library"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(201);
  });

  it("passes a 403 (author required) through as-is", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ detail: "author_required" }, 403);

    const response = await POST(postRequest({ widget_id: "w-1", name: "n" }));

    expect(response.status).toBe(403);
  });
});

describe("GET /api/dashboard/library", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the list request to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ items: [] }, 200);

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/library"),
      expect.objectContaining({ method: "GET" })
    );
    expect(response.status).toBe(200);
  });
});
