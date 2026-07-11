import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const BASE_URL = "http://localhost:3000/api/proxy/events";
const ACCESS_TOKEN = "token-abc";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

afterEach(() => vi.unstubAllGlobals());

// TASK-026 AC-7: proxies the CE-EVENT-1 beta seq feed poll.
describe("GET /api/proxy/events", () => {
  beforeEach(() => vi.mocked(auth).mockReset());

  it("forwards a 410 cursor_aged_out unwrapped, not as {detail: {...}}", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse({ detail: { error: "cursor_aged_out" } }, 410));

    const response = await GET(new NextRequest(`${BASE_URL}?since_seq=5`));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "cursor_aged_out" });
  });

  it("returns 422 on a missing/invalid since_seq", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse({}));
    const response = await GET(new NextRequest(BASE_URL));
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });
});
