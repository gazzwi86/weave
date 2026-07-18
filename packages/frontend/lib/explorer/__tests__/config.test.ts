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

// TASK-005 AC-1/AC-6 (SS-GE-4): domain-membership predicate is a config
// value, never a literal in query-builder/logic files.
describe("DEFAULT_EXPLORER_CONFIG -- TASK-005 additions", () => {
  it("has a non-empty absolute-IRI domainMembershipPredicate", () => {
    expect(DEFAULT_EXPLORER_CONFIG.domainMembershipPredicate).toMatch(/^https?:\/\//);
  });

  it("defaults expandConfirmThreshold to 500", () => {
    expect(DEFAULT_EXPLORER_CONFIG.expandConfirmThreshold).toBe(500);
  });
});

// TASK-021: heatmap/domain-colouring overlay config -- design-token colours,
// never literals inlined at the overlay call sites (Implementation Hints).
describe("DEFAULT_EXPLORER_CONFIG -- TASK-021 additions", () => {
  it("defaults heatNoneColour to the heat-ramp grey fallback token", () => {
    expect(DEFAULT_EXPLORER_CONFIG.heatNoneColour).toBe("var(--color-heat-none)");
  });

  it("defaults domainNoneColour to the kind-fallback token", () => {
    expect(DEFAULT_EXPLORER_CONFIG.domainNoneColour).toBe("var(--color-kind-fallback)");
  });

  it("defaults domainPalette to the 6-slot series token ramp", () => {
    expect(DEFAULT_EXPLORER_CONFIG.domainPalette).toEqual([
      "var(--color-series-1)",
      "var(--color-series-2)",
      "var(--color-series-3)",
      "var(--color-series-4)",
      "var(--color-series-5)",
      "var(--color-series-6)",
    ]);
  });

  // Dependencies: brief names prototype-findings.md as the source of real
  // value->colour vocabularies -- that file isn't present in this worktree
  // (flagged to team-lead). The four FR-015 dimensions are known structure
  // (not part of the missing file), so they're populated with empty value
  // maps -- gives the overlay panel four real toggles to render (Law 17)
  // while each one still hits AC-6's all-grey/no-data-note state until the
  // real vocab lands.
  it("defaults heatmapMappings to the four FR-015 dimensions with empty value vocab", () => {
    expect(DEFAULT_EXPLORER_CONFIG.heatmapMappings).toEqual({
      maturity: { path: "maturity", values: {} },
      investment: { path: "investment", values: {} },
      strategy: { path: "strategy", values: {} },
      lifecycle: { path: "lifecycle", values: {} },
    });
  });
});

// V3b-2 item 1: de-hairball label-thinning -- orienting kinds stay labelled
// below nodeLabelThreshold, never a literal inlined at the semantic-zoom
// call site.
describe("DEFAULT_EXPLORER_CONFIG -- V3b-2 additions", () => {
  it("defaults alwaysLabelledKinds to the domain/process landmark kinds", () => {
    expect(DEFAULT_EXPLORER_CONFIG.alwaysLabelledKinds).toEqual(["BusinessDomain", "Process"]);
  });
});

// V3b-3 item 1: sensible default filter -- a separate field from
// alwaysLabelledKinds (label visibility at zoom is a different concern from
// initial node visibility), even though M1 ships the same landmark kinds.
describe("DEFAULT_EXPLORER_CONFIG -- V3b-3 additions", () => {
  it("defaults defaultVisibleKinds to the domain/process landmark kinds", () => {
    expect(DEFAULT_EXPLORER_CONFIG.defaultVisibleKinds).toEqual(["BusinessDomain", "Process"]);
  });
});
