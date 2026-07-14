import { describe, expect, it } from "vitest";

// ONB-V1-TASK-005 AC-005-03: the M2 role-tailoring matrix, run against the
// REAL `TOURS` config and REAL `ANCHORS` registry (unlike
// tour-content.test.ts's mocked-anchor unit tests) -- this is the release-
// gate proof that `availableTours()` offers exactly the TASK-001 `paths`
// tags for every one of the 4 role paths, on the actual shipped M2 content.
// No browser needed: `availableTours` is a pure function over config, so
// this matrix is a real, always-runnable test -- not deferred like the
// Playwright specs that need a live server.

const M2_TOUR_IDS = [
  "tour.ge.completeness-map",
  "tour.plat.role-home",
  "tour.ge.trust-mechanics",
  "tour.ce.rules-policies",
] as const;

const ROLE_PATHS = ["business", "technical", "compliance", "admin"] as const;

describe("M2 role-tailoring matrix (AC-005-03)", () => {
  it.each(ROLE_PATHS)("path=%s: offered M2 tours match each tour's configured `paths` tag", async (path) => {
    const { availableTours } = await import("../tour-content");
    const { TOURS: allTours } = await import("../../../../shared/onboarding/content/tours");

    const offeredIds = new Set(availableTours(allTours, path).map((t) => t.tourId));

    for (const tourId of M2_TOUR_IDS) {
      const tour = allTours.find((t) => t.tourId === tourId);
      if (!tour) throw new Error(`M2 tour ${tourId} missing from TOURS config`);
      expect(offeredIds.has(tourId)).toBe(tour.paths.includes(path));
    }
  });

  it("no path is offered zero M2 tours (every path has at least one M2 overlay -- no dead CTA target)", async () => {
    const { availableTours } = await import("../tour-content");
    const { TOURS: allTours } = await import("../../../../shared/onboarding/content/tours");

    for (const path of ROLE_PATHS) {
      const offered = availableTours(allTours, path).filter((t) => M2_TOUR_IDS.includes(t.tourId as (typeof M2_TOUR_IDS)[number]));
      expect(offered.length).toBeGreaterThan(0);
    }
  });
});
