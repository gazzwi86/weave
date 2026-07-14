import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useWhatsNewUnread } from "../use-whats-new-unread";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

// AC-012-04: unread dot driven by whats_new_seen_at vs. the newest item's publishedAt.
describe("useWhatsNewUnread (AC-012-04)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is unread when whats_new_seen_at is null and items exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ whats_new_seen_at: null }))
    );

    const { result } = renderHook(() => useWhatsNewUnread());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unread).toBe(true);
  });

  it("is read when whats_new_seen_at is newer than every item's publishedAt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ whats_new_seen_at: "2099-01-01T00:00:00Z" }))
    );

    const { result } = renderHook(() => useWhatsNewUnread());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unread).toBe(false);
  });

  it("markSeen() PATCHes whats_new_seen_at and clears the dot optimistically", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ whats_new_seen_at: null }))
      .mockResolvedValueOnce(jsonResponse({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWhatsNewUnread());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unread).toBe(true);

    await act(async () => {
      await result.current.markSeen();
    });

    expect(result.current.unread).toBe(false);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/onboarding/state",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("whats_new_seen_at"),
      })
    );
  });
});
