import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { PUT, DELETE } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

function params(kind: string, refId: string): { params: Promise<{ kind: string; refId: string }> } {
  return { params: Promise.resolve({ kind, refId }) };
}

const request = new NextRequest("http://localhost:3000/api/onboarding/dismissals/beacon/ce-versions", { method: "PUT" });

describe("PUT /api/onboarding/dismissals/[kind]/[refId]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await PUT(request, params("beacon", "ce-versions"));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid dismissal kind (Law 13)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(request, params("not-a-kind", "ce-versions"));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-008-02: persists a beacon dismissal server-side, per user", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PUT(request, params("beacon", "ce-versions"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/dismissals/beacon/ce-versions"),
      expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/onboarding/dismissals/[kind]/[refId]", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("AC-008-04: un-dismisses a single welcome modal", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await DELETE(request, params("welcome_modal", "welcome-constitution"));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/dismissals/welcome_modal/welcome-constitution"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(response.status).toBe(200);
  });
});
