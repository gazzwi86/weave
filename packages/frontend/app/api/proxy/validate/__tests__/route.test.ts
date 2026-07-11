import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "token-abc";

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/proxy/validate?${query}`);
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function mockAuthedSession(accessToken: string | null = TOKEN): void {
  vi.mocked(auth).mockResolvedValue((accessToken ? { accessToken } : null) as never);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("GET /api/proxy/validate", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    mockAuthedSession(null);

    const response = await GET(makeRequest("version=draft"));

    expect(response.status).toBe(401);
  });

  it("forwards version/run and the bearer token, passes through a pending body", async () => {
    mockAuthedSession();
    stubFetch(jsonResponse(200, { pending: true }));

    const response = await GET(makeRequest("version=draft&run=true"));
    const body = (await response.json()) as { pending: boolean };

    expect(response.status).toBe(200);
    expect(body.pending).toBe(true);
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    const calledUrl = call[0] as string;
    expect(calledUrl).toContain("version=draft");
    expect(calledUrl).toContain("run=true");
    expect((call[1] as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
    });
  });

  it("returns 400 on an invalid run value", async () => {
    mockAuthedSession();

    const response = await GET(makeRequest("run=maybe"));

    expect(response.status).toBe(400);
  });

  it("returns 503 when the upstream call fails", async () => {
    mockAuthedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const response = await GET(makeRequest("version=draft"));

    expect(response.status).toBe(503);
  });
});
