import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeRequest(id: string): { request: NextRequest; params: Promise<{ id: string }> } {
  return {
    request: new NextRequest(`http://localhost:3000/api/requests/${id}/stream`),
    params: Promise.resolve({ id }),
  };
}

describe("GET /api/requests/[id]/stream", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when no session, without calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { request, params } = makeRequest("req-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid request id, without calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { request, params } = makeRequest("");
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("streams the upstream SSE body through unbuffered", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    const upstreamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"section":"brief","content":"x","done":false}\n\n')
        );
        controller.close();
      },
    });
    const fetchSpy = vi.fn(
      async () =>
        new Response(upstreamBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { request, params } = makeRequest("req-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const text = await response.text();
    expect(text).toBe('data: {"section":"brief","content":"x","done":false}\n\n');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/requests/req-1/stream"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const { request, params } = makeRequest("req-1");
    const response = await GET(request, { params });

    expect(response.status).toBe(502);
  });
});
