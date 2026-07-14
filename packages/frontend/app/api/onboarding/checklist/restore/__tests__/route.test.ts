import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("POST /api/onboarding/checklist/restore", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(
      new Response(JSON.stringify({ checklist_dismissed_at: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-010-05: restores a dismissed checklist, per user", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/checklist/restore"),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
    expect(response.status).toBe(200);
  });
});
