import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("DELETE /api/onboarding/dismissals/beacon", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify({ deleted_count: 3 }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-008-02: bulk-restores all dismissed beacons ('Show all hints')", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await DELETE();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/dismissals/beacon"),
      expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted_count: 3 });
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await DELETE();

    expect(response.status).toBe(502);
  });
});
