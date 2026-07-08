import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const VERIFY_RESULT = { valid: true, entries_checked: 42, first_broken_seq: null, error: null };

describe("POST /api/audit/verify", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(VERIFY_RESULT), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    );
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the bearer token as a POST and proxies the result", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await POST();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/audit/verify"),
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token-abc" },
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(VERIFY_RESULT);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await POST();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
