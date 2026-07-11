import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/widgets/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/dashboard/widgets/generate", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when no session, without calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(makePost({ prompt: "show entities" }));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty prompt, without calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(makePost({ prompt: "" }));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("streams the upstream SSE body through unbuffered", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    const upstreamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: spec\ndata: {"a":1}\n\n'));
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

    const response = await POST(makePost({ prompt: "show entities" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const text = await response.text();
    expect(text).toBe('event: spec\ndata: {"a":1}\n\n');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets/generate"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
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

    const response = await POST(makePost({ prompt: "show entities" }));

    expect(response.status).toBe(502);
  });
});
