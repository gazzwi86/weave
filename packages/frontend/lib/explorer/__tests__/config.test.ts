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

// TASK-004 AC-1/AC-2: layout-save retry backoff and the fixed M1 canvas
// graph id must be tunable config values, never literals inlined at call
// sites (Implementation Hints).
describe("DEFAULT_EXPLORER_CONFIG -- TASK-004 additions", () => {
  it("defaults layoutSaveRetryDelaysMs to a 3-step exponential backoff", () => {
    expect(DEFAULT_EXPLORER_CONFIG.layoutSaveRetryDelaysMs).toEqual([2000, 4000, 8000]);
  });

  it("defaults layoutGraphId to the M1 whole-company canvas id", () => {
    expect(DEFAULT_EXPLORER_CONFIG.layoutGraphId).toBe("whole-company");
  });
});
