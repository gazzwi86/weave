import { describe, expect, it } from "vitest";

import type { Tour } from "../../../../shared/onboarding/content/schema";
import { COMPLETENESS_TOUR_QUERY_VALUE, shouldAutoStartCompletenessTour } from "../explorer-tour";

const tour: Tour = {
  tourId: "tour.ge.completeness-map",
  area: "explorer",
  paths: ["business", "technical"],
  phase: "m2",
  steps: [{ anchorId: "ge.overlay.controls", titleKey: "t1", bodyKey: "b1" }],
};

describe("shouldAutoStartCompletenessTour (AC-002-01/04)", () => {
  it("starts when the query value matches, the path opts in, and anchors are shipped", () => {
    expect(shouldAutoStartCompletenessTour(COMPLETENESS_TOUR_QUERY_VALUE, "business", tour)).toBe(true);
  });

  it("does not start for an unrelated or missing query param", () => {
    expect(shouldAutoStartCompletenessTour(null, "business", tour)).toBe(false);
    expect(shouldAutoStartCompletenessTour("something-else", "business", tour)).toBe(false);
  });

  it("does not start before the role path has resolved", () => {
    expect(shouldAutoStartCompletenessTour(COMPLETENESS_TOUR_QUERY_VALUE, null, tour)).toBe(false);
  });

  it("does not start for a role path the tour doesn't cover", () => {
    expect(shouldAutoStartCompletenessTour(COMPLETENESS_TOUR_QUERY_VALUE, "compliance", tour)).toBe(false);
  });
});
