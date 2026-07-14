import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { PATCH } from "../route";

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

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dashboard/widgets/order", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/dashboard/widgets/order", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({ updated: 2 }, 200);

    const response = await PATCH(patchRequest({ ids_in_order: ["a", "b"] }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty ids_in_order", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ updated: 0 }, 200);

    const response = await PATCH(patchRequest({ ids_in_order: [] }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid reorder batch to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ updated: 2 }, 200);

    const response = await PATCH(patchRequest({ ids_in_order: ["b", "a"] }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/dashboard/widgets/order"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        body: JSON.stringify({ ids_in_order: ["b", "a"] }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 2 });
  });
});
