import { describe, expect, it, vi } from "vitest";

import { ANCHORS } from "../../../../shared/onboarding/anchors";
import { TOURS } from "../../../../shared/onboarding/content/tours";
import { isTourShipped, renderableSteps } from "../tour-content";

// ONB-V1-TASK-002: real config, not the mocked-ANCHORS fixture used by
// tour-content.test.ts's generic isTourShipped/renderableSteps tests --
// this pins the actual `tour.ge.completeness-map` anchors this task plants.
const completenessTour = TOURS.find((t) => t.tourId === "tour.ge.completeness-map");

if (!completenessTour) {
  throw new Error("tour.ge.completeness-map missing from TOURS -- TASK-001 config regressed");
}

describe("tour.ge.completeness-map (AC-002-01/04)", () => {
  it("targets ge.overlay.controls then ge.overlay.completeness-legend", () => {
    expect(completenessTour.steps.map((s) => s.anchorId)).toEqual([
      "ge.overlay.controls",
      "ge.overlay.completeness-legend",
    ]);
  });

  it("is offered once both its GE anchors are shipped (ADR-008, per-anchor gating)", () => {
    expect(ANCHORS["ge.overlay.controls"].shipped).toBe(true);
    expect(ANCHORS["ge.overlay.completeness-legend"].shipped).toBe(true);
    expect(isTourShipped(completenessTour)).toBe(true);
  });

  it("skips an absent completeness-map anchor with a logged warning, never blocking (AC-002-04)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const steps = renderableSteps(completenessTour, (id) => id === "ge.overlay.controls");

    expect(steps).toEqual([completenessTour.steps[0]]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ge.overlay.completeness-legend"));
    warn.mockRestore();
  });
});
