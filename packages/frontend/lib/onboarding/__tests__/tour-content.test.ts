import { describe, expect, it, vi } from "vitest";

import type { Tour } from "../../../../shared/onboarding/content/schema";

// Isolate this unit test from the real (mutable-over-time) ANCHORS registry
// content -- only the `shipped` flag's semantics are under test here.
vi.mock("../../../../shared/onboarding/anchors", () => ({
  ANCHORS: {
    "ce.overview": { shipped: true },
    "ce.glossary": { shipped: true },
    "ce.metrics-tile": { shipped: false },
  },
}));

const { availableTours, isTourShipped, renderableSteps } = await import("../tour-content");

const shippedTour: Tour = {
  tourId: "ce-overview",
  area: "constitution",
  paths: ["business", "technical"],
  phase: "m1",
  steps: [
    { anchorId: "ce.overview", titleKey: "t1", bodyKey: "b1" },
    { anchorId: "ce.glossary", titleKey: "t2", bodyKey: "b2" },
  ],
};

const unshippedTour: Tour = {
  tourId: "future-tour",
  area: "constitution",
  paths: ["business"],
  phase: "m2",
  steps: [{ anchorId: "ce.metrics-tile", titleKey: "t", bodyKey: "b" }],
};

describe("isTourShipped (AC-007-04)", () => {
  it("is true when every step anchor is shipped", () => {
    expect(isTourShipped(shippedTour)).toBe(true);
  });

  it("is false when any step anchor is not yet shipped", () => {
    expect(isTourShipped(unshippedTour)).toBe(false);
  });
});

describe("availableTours (AC-007-05)", () => {
  it("includes only tours whose paths include the resolved path", () => {
    expect(availableTours([shippedTour], "business")).toEqual([shippedTour]);
    expect(availableTours([shippedTour], "compliance")).toEqual([]);
  });

  it("excludes tours whose anchors are not fully shipped", () => {
    expect(availableTours([unshippedTour], "business")).toEqual([]);
  });

  it("does not exclude a tour based on completion state -- re-takeable any time", () => {
    // availableTours has no notion of completion at all; presence in the
    // returned list is the contract a caller relies on for re-take.
    expect(availableTours([shippedTour], "business")).toContain(shippedTour);
  });
});

describe("renderableSteps (AC-007-04)", () => {
  it("keeps steps whose anchor is present", () => {
    const steps = renderableSteps(shippedTour, () => true);
    expect(steps).toHaveLength(2);
  });

  it("skips steps whose anchor is absent and logs a warning naming the anchor id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const steps = renderableSteps(shippedTour, (id) => id === "ce.overview");
    expect(steps).toEqual([{ anchorId: "ce.overview", titleKey: "t1", bodyKey: "b1" }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ce.glossary"));
    warn.mockRestore();
  });

  it("never blocks the tour -- returns an empty array rather than throwing when all anchors absent", () => {
    expect(renderableSteps(shippedTour, () => false)).toEqual([]);
  });
});
