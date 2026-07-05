import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useNotifications } from "../use-notifications";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}

// Fake timers aren't used here (no debounce), but a fetch().then() chain
// still needs real microtask ticks to settle after render (same pattern as
// use-entity-search.test.ts's flushMicrotasks).
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("useNotifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches unread notifications on mount and derives the unread count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          notifications: [
            { id: "n-1", event_type: "job.completed", payload: {}, delivered_channels: ["in_app"], read: false, created_at: "2026-07-04T00:00:00Z" },
            { id: "n-2", event_type: "job.failed", payload: {}, delivered_channels: ["in_app"], read: false, created_at: "2026-07-04T00:00:00Z" },
          ],
          total: 2,
          page: 1,
          per_page: 25,
        })
      )
    );

    const { result } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/notifications?unread=true"),
      expect.anything()
    );
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.error).toBe(false);
  });

  it("surfaces an error on a real fetch failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const { result } = renderHook(() => useNotifications());
    await flushMicrotasks();

    expect(result.current.error).toBe(true);
    expect(result.current.notifications).toEqual([]);
  });

  it("markRead flips the item to read locally and posts to the read endpoint", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/read")) {
        return jsonResponse({ id: "n-1", read: true });
      }
      return jsonResponse({
        notifications: [
          { id: "n-1", event_type: "job.completed", payload: {}, delivered_channels: ["in_app"], read: false, created_at: "2026-07-04T00:00:00Z" },
        ],
        total: 1,
        page: 1,
        per_page: 25,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotifications());
    await flushMicrotasks();

    await act(async () => {
      await result.current.markRead("n-1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/notifications/n-1/read"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.current.notifications[0]?.read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("refresh() re-fetches", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ notifications: [], total: 0, page: 1, per_page: 25 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotifications());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
