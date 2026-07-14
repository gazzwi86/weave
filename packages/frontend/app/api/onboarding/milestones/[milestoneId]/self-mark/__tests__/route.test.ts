import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function params(milestoneId: string): { params: Promise<{ milestoneId: string }> } {
  return { params: Promise.resolve({ milestoneId }) };
}

const request = new NextRequest("http://localhost:3000/api/onboarding/milestones/invite_admin/self-mark", {
  method: "POST",
});

describe("POST /api/onboarding/milestones/[milestoneId]/self-mark", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify({ marked: true }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(request, params("invite_admin"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-010-03: self-marks the invite-admin milestone, per user", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST(request, params("invite_admin"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/milestones/invite_admin/self-mark"),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
    expect(response.status).toBe(200);
  });
});
