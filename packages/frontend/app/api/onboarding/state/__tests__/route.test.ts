import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { GET } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const stateBody = {
  role_path: "business",
  path_variant: "default",
  path_chosen_manually: false,
  checklist_dismissed_at: null,
  checklist_completed_at: null,
  whats_new_seen_at: null,
  tours: [],
  dismissals: [{ kind: "beacon", ref_id: "ce-versions", dismissed_at: "2026-01-01T00:00:00Z" }],
  exercise_completions: [],
  activations: [],
};

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("GET /api/onboarding/state", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify(stateBody), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the bearer token and returns the bootstrap state, including dismissals", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await GET();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/state"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stateBody);
  });

  it("returns a distinguishable error when the backend is unreachable", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
