import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../[id]/route";
import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )
  );
}

const VALID_BODY = {
  prompt: "an expense tracker",
  run_mode: "draft_spec_only",
  name: "Expense tracker",
};

describe("POST /api/requests", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({ request_id: "req-1", status: "drafting", stream_url: "s" }, 202);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makePost(VALID_BODY));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(fetch).not.toHaveBeenCalled();
  });

  // Law 13: body is untrusted input, validated via zod.
  it("returns 400 for an invalid run_mode", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makePost({ prompt: "x", run_mode: "yolo" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards to the backend and passes the 202 through", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makePost(VALID_BODY));

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/requests",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ ...VALID_BODY, grounding_entity_iris: [] }),
      })
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      request_id: "req-1",
      status: "drafting",
      stream_url: "s",
    });
  });

  it("passes backend 503 model_unavailable through", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ detail: { error: "model_unavailable" } }, 503);

    const response = await POST(makePost(VALID_BODY));

    expect(response.status).toBe(503);
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST(makePost(VALID_BODY));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});

describe("GET /api/requests/[id]", () => {
  const request = new NextRequest("http://localhost:3000/api/requests/req-1");

  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      {
        request_id: "req-1",
        status: "drafting",
        run_mode: "draft_spec_only",
        graph_context: {},
        draft_content: null,
        created_at: "2026-07-08T00:00:00Z",
      },
      200
    );
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(request, { params: Promise.resolve({ id: "req-1" }) });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards to the backend with the bearer token", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET(request, { params: Promise.resolve({ id: "req-1" }) });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/requests/req-1",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-abc" },
      })
    );
    expect(response.status).toBe(200);
  });

  it("passes backend 404 not_found through", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ detail: { error: "not_found" } }, 404);

    const response = await GET(request, { params: Promise.resolve({ id: "req-9" }) });

    expect(response.status).toBe(404);
  });
});
