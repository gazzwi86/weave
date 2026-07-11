import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET, POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const BASE_URL = "http://localhost:3000/api/proxy/views";
const ACCESS_TOKEN = "token-abc";

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, { method: "POST", body: JSON.stringify(body) });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

afterEach(() => vi.unstubAllGlobals());

// TASK-026 AC-1/AC-4: proxies POST/GET /api/views, attaching the caller's
// session bearer token server-side (Law 13 zod-validated body).
describe("GET /api/proxy/views", () => {
  beforeEach(() => vi.mocked(auth).mockReset());

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("forwards the tenant view list with the bearer token attached", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse([{ view_id: "v1", name: "A", created_by: "u1", pinned: false, updated_at: "2026-01-01" }]));

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/views"),
      expect.objectContaining({ headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } })
    );
    expect(response.status).toBe(200);
  });
});

describe("POST /api/proxy/views", () => {
  beforeEach(() => vi.mocked(auth).mockReset());

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(jsonResponse({}));
    const response = await POST(makePostRequest({ name: "n", definition: {}, positions: [] }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 422 on an invalid body (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    const response = await POST(makePostRequest({ name: "" }));
    expect(response.status).toBe(422);
  });

  it("unwraps a 409 name-collision detail envelope into a flat error body (AC-1)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: ACCESS_TOKEN } as never);
    stubFetch(jsonResponse({ detail: { error: "name_collision", existing_view_id: "v9" } }, 409));

    const response = await POST(makePostRequest({ name: "n", definition: {}, positions: [] }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "name_collision", existing_view_id: "v9" });
  });
});
