import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// TASK-004 AC-004-04: E4-S2 AI extraction is Should-Have/deferred -- this
// route is the single stub the frontend calls today, and the single place
// a future backend wiring lands (additive, no button/component rewrite).
describe("POST /api/proxy/brand/extract", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("always returns 503 extraction_not_available for an authenticated caller", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "extraction_not_available" });
  });
});
