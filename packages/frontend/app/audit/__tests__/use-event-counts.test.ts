import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sumEventCounts, useEventCounts } from "../use-event-counts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("useEventCounts (G6)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches /api/audit/counts scoped to the current month and maps event_type -> count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          counts: [
            { event_type: "access.rbac.denied", count: 3 },
            { event_type: "billing.cap.changed", count: 1 },
          ],
        })
      )
    );

    const { result } = renderHook(() => useEventCounts());

    await waitFor(() => expect(result.current.counts).not.toBeNull());
    expect(result.current.denied).toBe(false);
    expect(result.current.loadError).toBe(false);
    expect(sumEventCounts(result.current.counts, ["access.rbac.denied", "authz_denied"])).toBe(3);
    expect(sumEventCounts(result.current.counts, ["billing.cap.changed"])).toBe(1);
    expect(sumEventCounts(result.current.counts, ["build.budget.breach"])).toBe(0);

    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain("/api/audit/counts?");
    expect(new URL(calledUrl, "http://localhost").searchParams.get("date_from")).toBeTruthy();
  });

  it("sums multiple event_types for one metric (open dotted vocabulary, no fixed enum)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          counts: [
            { event_type: "authz_denied", count: 2 },
            { event_type: "access.rbac.denied", count: 5 },
          ],
        })
      )
    );

    const { result } = renderHook(() => useEventCounts());

    await waitFor(() => expect(result.current.counts).not.toBeNull());
    expect(sumEventCounts(result.current.counts, ["access.rbac.denied", "authz_denied"])).toBe(7);
  });

  it("sets denied on a 403 without setting loadError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "forbidden" }, 403)));

    const { result } = renderHook(() => useEventCounts());

    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.loadError).toBe(false);
    expect(result.current.counts).toBeNull();
  });

  it("sets loadError when the fetch fails outright", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network_down");
      })
    );

    const { result } = renderHook(() => useEventCounts());

    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.denied).toBe(false);
  });
});
