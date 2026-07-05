import { describe, expect, it } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "../config";

// AC-1/AC-6: spotlight dim opacity and the search-result centre animation
// duration must be tunable config values, never literals inlined at call
// sites (Implementation Hints).
describe("DEFAULT_EXPLORER_CONFIG -- TASK-003 additions", () => {
  it("defaults spotlightDimOpacity to 0.18", () => {
    expect(DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity).toBeCloseTo(0.18);
  });

  it("defaults centreAnimationMs to 300", () => {
    expect(DEFAULT_EXPLORER_CONFIG.centreAnimationMs).toBe(300);
  });
});
