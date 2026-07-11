import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = "test-token";

const WIDGETS_RESPONSE = { widgets: [] };

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

describe("GET /api/dashboard/widgets", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch(WIDGETS_RESPONSE, 200);

    const response = await GET(new NextRequest("http://localhost:3000/api/dashboard/widgets"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the scope query param to the backend (Law B: real state read)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(WIDGETS_RESPONSE, 200);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/dashboard/widgets?scope=user")
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets?scope=user"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(WIDGETS_RESPONSE);
  });

  it("defaults to tenant_default when scope is omitted", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch(WIDGETS_RESPONSE, 200);

    await GET(new NextRequest("http://localhost:3000/api/dashboard/widgets"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets?scope=tenant_default"),
      expect.anything()
    );
  });
});
