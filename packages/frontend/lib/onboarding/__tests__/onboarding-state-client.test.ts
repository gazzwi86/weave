import { describe, expect, it, vi, beforeEach } from "vitest";

import { fetchOnboardingStateOnce } from "../onboarding-state-client";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

// H8: four dashboard-mounted readers (PracticeModeBanner, useDismissals,
// useWhatsNewUnread, ChecklistWidget) all call this -- exactly one network
// fetch must serve all of them.
describe("fetchOnboardingStateOnce", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dedupes concurrent callers into a single fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ sandbox_forked_at: "2026-07-01T00:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second, third, fourth] = await Promise.all([
      fetchOnboardingStateOnce(),
      fetchOnboardingStateOnce(),
      fetchOnboardingStateOnce(),
      fetchOnboardingStateOnce(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ sandbox_forked_at: "2026-07-01T00:00:00Z" });
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(third).toBe(fourth);
  });

  it("fetches again after the previous call resolves", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sandbox_forked_at: null }))
      .mockResolvedValueOnce(jsonResponse({ sandbox_forked_at: "2026-07-02T00:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchOnboardingStateOnce();
    const second = await fetchOnboardingStateOnce();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ sandbox_forked_at: "2026-07-02T00:00:00Z" });
  });

  it("resolves null on a non-ok response instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 }))
    );

    await expect(fetchOnboardingStateOnce()).resolves.toBeNull();
  });
});
