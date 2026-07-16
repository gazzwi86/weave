import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/ingest/proposals/p1/reject", { method: "POST" });
}

describe("POST /api/ingest/proposals/[id]/reject", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({ id: "p1", status: "rejected" }, 200);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards reject to the backend and returns 200 (AC-002-05)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "p1", status: "rejected" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/proposals/p1/reject");
    expect(init.method).toBe("POST");
  });
});
