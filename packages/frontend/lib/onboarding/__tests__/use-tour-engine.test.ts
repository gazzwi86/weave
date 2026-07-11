import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTourEngine } from "../use-tour-engine";
import type { Tour } from "../../../../shared/onboarding/content/schema";

const tour: Tour = {
  tourId: "ce-overview",
  area: "constitution",
  paths: ["business"],
  phase: "m1",
  steps: [
    { anchorId: "ce.overview", titleKey: "t1", bodyKey: "b1" },
    { anchorId: "ce.glossary", titleKey: "t2", bodyKey: "b2" },
    { anchorId: "ce.query", titleKey: "t3", bodyKey: "b3" },
  ],
};

describe("useTourEngine (AC-007-01/02/04/05)", () => {
  it("starts idle, then active at step 0 with the full renderable count", () => {
    const { result } = renderHook(() =>
      useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: () => true }),
    );
    expect(result.current.status).toBe("idle");

    act(() => result.current.start());

    expect(result.current.status).toBe("active");
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.totalSteps).toBe(3);
    expect(result.current.activeStep?.anchorId).toBe("ce.overview");
  });

  it("next advances and persists the step just left; back does not persist", () => {
    const onPersist = vi.fn();
    const { result } = renderHook(() => useTourEngine({ tour, onPersist, hasAnchor: () => true }));
    act(() => result.current.start());

    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(1);
    expect(onPersist).toHaveBeenCalledWith({ lastCompletedStep: 0, completed: false, skipped: false });

    onPersist.mockClear();
    act(() => result.current.back());
    expect(result.current.activeIndex).toBe(0);
    expect(onPersist).not.toHaveBeenCalled();
  });

  it("next on the final step completes the tour and persists completed:true", () => {
    const onPersist = vi.fn();
    const { result } = renderHook(() => useTourEngine({ tour, onPersist, hasAnchor: () => true }));
    act(() => result.current.start());
    act(() => result.current.next());
    act(() => result.current.next());

    expect(result.current.activeIndex).toBe(2);
    onPersist.mockClear();
    act(() => result.current.next());

    expect(result.current.status).toBe("done");
    expect(onPersist).toHaveBeenCalledWith({ lastCompletedStep: 2, completed: true, skipped: false });
  });

  it("skip exits without deleting progress and persists skipped:true (AC-007-02)", () => {
    const onPersist = vi.fn();
    const { result } = renderHook(() => useTourEngine({ tour, onPersist, hasAnchor: () => true }));
    act(() => result.current.start());
    act(() => result.current.next());

    act(() => result.current.skip());

    expect(result.current.status).toBe("done");
    // the skip() call persists skipped:true at the index it left off (step 1, after one `next`).
    expect(onPersist).toHaveBeenLastCalledWith({ lastCompletedStep: 1, completed: false, skipped: true });
  });

  it("resume picks up at the persisted last-completed-step", () => {
    const { result } = renderHook(() =>
      useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: () => true }),
    );

    act(() => result.current.resume({ lastCompletedStep: 2, completed: false, skipped: true }));

    expect(result.current.status).toBe("active");
    expect(result.current.activeIndex).toBe(2);
  });

  it("skips absent-anchor steps from the renderable sequence and count (AC-007-04)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: (id) => id !== "ce.glossary" }),
    );

    act(() => result.current.start());

    expect(result.current.totalSteps).toBe(2);
    expect(result.current.steps.map((s) => s.anchorId)).toEqual(["ce.overview", "ce.query"]);
    warn.mockRestore();
  });

  it("never blocks -- an all-absent tour goes straight to done with zero steps", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: () => false }),
    );

    act(() => result.current.start());

    expect(result.current.status).toBe("done");
    expect(result.current.totalSteps).toBe(0);
    warn.mockRestore();
  });

  it("re-take: start() after done resets to step 0 (AC-007-05)", () => {
    const { result } = renderHook(() =>
      useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: () => true }),
    );
    act(() => result.current.start());
    act(() => result.current.skip());
    expect(result.current.status).toBe("done");

    act(() => result.current.start());

    expect(result.current.status).toBe("active");
    expect(result.current.activeIndex).toBe(0);
  });
});
