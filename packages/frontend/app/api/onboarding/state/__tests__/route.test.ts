import { describe, expect, it, beforeEach, vi } from "vitest";

import { auth } from "@/auth";

import { GET, PATCH } from "../route";

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

// ONB-TASK-012 AC-012-04 / TASK-010 AC-010-05: PATCH clears the What's-new
// unread dot and forwards checklist dismiss/completion.
describe("PATCH /api/onboarding/state", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch(new Response(JSON.stringify(stateBody), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await PATCH(new Request("http://localhost/api/onboarding/state", { method: "PATCH", body: "{}" }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the bearer token and body to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/onboarding/state", {
        method: "PATCH",
        body: JSON.stringify({ whats_new_seen_at: "2026-07-14T00:00:00Z" }),
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/state"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ whats_new_seen_at: "2026-07-14T00:00:00Z" }),
      })
    );
    expect(response.status).toBe(200);
  });

  it("AC-010-05: forwards a checklist dismissal patch to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/onboarding/state", {
        method: "PATCH",
        body: JSON.stringify({ checklist_dismissed_at: "2026-07-14T00:00:00Z" }),
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/onboarding/state"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ checklist_dismissed_at: "2026-07-14T00:00:00Z" }),
      })
    );
    expect(response.status).toBe(200);
  });

  it("XT-ONB010-1: forwards a checklist true-completion patch to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/onboarding/state", {
        method: "PATCH",
        body: JSON.stringify({ checklist_completed_at: "2026-07-14T00:00:00Z" }),
      })
    );

    expect(response.status).toBe(200);
  });

  // Edge case (QA): the Zod schema (Law 13) is the only guard between an
  // arbitrary client payload and the upstream PATCH -- must actually reject.
  it("rejects a malformed whats_new_seen_at without ever calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/onboarding/state", {
        method: "PATCH",
        body: JSON.stringify({ whats_new_seen_at: "not-a-date" }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a missing body without ever calling the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);

    const response = await PATCH(new Request("http://localhost/api/onboarding/state", { method: "PATCH" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
