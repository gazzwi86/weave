import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useDismissals } from "../use-dismissals";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("useDismissals (AC-008-02/04)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bootstraps dismissals from /api/onboarding/state on mount", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/api/onboarding/state");
      return jsonResponse({ dismissals: [{ kind: "beacon", ref_id: "ce-versions", dismissed_at: "2026-01-01T00:00:00Z" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDismissals());

    await waitFor(() => expect(result.current.isDismissed("beacon", "ce-versions")).toBe(true));
  });

  it("dismiss() PUTs the dismissal and marks it dismissed optimistically", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ dismissals: [] }))
      .mockResolvedValueOnce(jsonResponse({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDismissals());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.dismiss("beacon", "ce-versions");
    });

    expect(result.current.isDismissed("beacon", "ce-versions")).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/onboarding/dismissals/beacon/ce-versions", expect.objectContaining({ method: "PUT" }));
  });

  it("restoreAllBeacons() bulk-DELETEs and clears every beacon dismissal ('Show all hints')", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          dismissals: [
            { kind: "beacon", ref_id: "ce-versions", dismissed_at: "2026-01-01T00:00:00Z" },
            { kind: "welcome_modal", ref_id: "welcome-constitution", dismissed_at: "2026-01-01T00:00:00Z" },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ deleted_count: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDismissals());
    await waitFor(() => expect(result.current.isDismissed("beacon", "ce-versions")).toBe(true));

    await act(async () => {
      await result.current.restoreAllBeacons();
    });

    expect(result.current.isDismissed("beacon", "ce-versions")).toBe(false);
    expect(result.current.isDismissed("welcome_modal", "welcome-constitution")).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/onboarding/dismissals/beacon", expect.objectContaining({ method: "DELETE" }));
  });
});
