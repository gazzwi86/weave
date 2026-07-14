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

  it("ONB-V1-TASK-003: exposes checklist signals + rolePath from the same bootstrap fetch (no second call)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        dismissals: [],
        role_path: "business",
        sandbox_workspace_id: null,
        sandbox_forked_at: null,
        tours: [],
        exercise_completions: [],
        activations: [{ milestone_id: "add_competency_questions", activated_at: "2026-01-01T00:00:00Z", source: "manual" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDismissals());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rolePath).toBe("business");
    expect(result.current.signals.activations).toEqual([
      { milestone_id: "add_competency_questions", activated_at: "2026-01-01T00:00:00Z", source: "manual" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
