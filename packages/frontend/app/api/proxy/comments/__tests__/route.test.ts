import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const BASE_URL = "http://localhost:3000/api/proxy/comments";
const ACCESS_TOKEN = "token-abc";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/proxy/comments", () => {
  beforeEach(() => vi.mocked(auth).mockReset());

  it("returns 400 missing_target when target_kind/target_ref are absent", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse([]));
    const response = await GET(new NextRequest(BASE_URL));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid node-target list request", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse([]));
    const response = await GET(new NextRequest(`${BASE_URL}?target_kind=node&target_ref=iri:n1`));
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("target_kind=node"), expect.anything());
  });
});

describe("POST /api/proxy/comments", () => {
  beforeEach(() => vi.mocked(auth).mockReset());

  it("never accepts a client-supplied author (the schema has no such field)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse({ comment_id: "c1" }, 201));

    await POST(
      new NextRequest(BASE_URL, {
        method: "POST",
        body: JSON.stringify({ target_kind: "node", target_ref: "iri:n1", body: "hi", author: "iri:spoofed" }),
      })
    );

    const sentBody = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as { body: string }).body);
    expect(sentBody).not.toHaveProperty("author");
  });
});
