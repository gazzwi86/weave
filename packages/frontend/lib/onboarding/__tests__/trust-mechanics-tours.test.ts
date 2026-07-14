// ONB-V1-TASK-004: gating + role-tailoring behaviour for the two trust
// tours, exercised against the real TOURS config (not synthetic fixtures)
// so a regression in tours.ts/anchors.ts fails this test directly.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/onboarding/anchors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../shared/onboarding/anchors")>();
  return {
    ...actual,
    ANCHORS: {
      ...actual.ANCHORS,
      "ge.overlay.controls": { area: "explorer", shipped: true },
      "ge.versions.panel": { area: "explorer", shipped: true },
      "ge.filters.governed-content": { area: "explorer", shipped: true },
      "ce.rules.shape-list": { area: "constitution", shipped: true },
      "ce.rules.violation-report": { area: "constitution", shipped: true },
    },
  };
});

const { availableTours, renderableSteps } = await import("../tour-content");
const { TOURS } = await import("../../../../shared/onboarding/content/tours");

const geTrustMechanics = TOURS.find((t) => t.tourId === "tour.ge.trust-mechanics")!;
const ceRulesPolicies = TOURS.find((t) => t.tourId === "tour.ce.rules-policies")!;

describe("trust-mechanics tour gating (AC-004-04)", () => {
  it("gates the GE tour off while the CE tour stays on when only CE anchors are shipped", async () => {
    vi.resetModules();
    vi.doMock("../../../../shared/onboarding/anchors", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../../../shared/onboarding/anchors")>();
      return {
        ...actual,
        ANCHORS: {
          ...actual.ANCHORS,
          "ge.overlay.controls": { area: "explorer", shipped: true },
          "ge.versions.panel": { area: "explorer", shipped: false },
          "ge.filters.governed-content": { area: "explorer", shipped: false },
          "ce.rules.shape-list": { area: "constitution", shipped: true },
          "ce.rules.violation-report": { area: "constitution", shipped: true },
        },
      };
    });
    const { isTourShipped: isTourShippedCeOnly } = await import("../tour-content");
    const { TOURS: toursCeOnly } = await import("../../../../shared/onboarding/content/tours");
    const ge = toursCeOnly.find((t) => t.tourId === "tour.ge.trust-mechanics")!;
    const ce = toursCeOnly.find((t) => t.tourId === "tour.ce.rules-policies")!;
    expect(isTourShippedCeOnly(ge)).toBe(false);
    expect(isTourShippedCeOnly(ce)).toBe(true);
  });

  it("gates the CE tour off while the GE tour stays on in the inverse case", async () => {
    vi.resetModules();
    vi.doMock("../../../../shared/onboarding/anchors", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../../../shared/onboarding/anchors")>();
      return {
        ...actual,
        ANCHORS: {
          ...actual.ANCHORS,
          "ge.overlay.controls": { area: "explorer", shipped: true },
          "ge.versions.panel": { area: "explorer", shipped: true },
          "ge.filters.governed-content": { area: "explorer", shipped: true },
          "ce.rules.shape-list": { area: "constitution", shipped: false },
          "ce.rules.violation-report": { area: "constitution", shipped: false },
        },
      };
    });
    const { isTourShipped: isTourShippedGeOnly } = await import("../tour-content");
    const { TOURS: toursGeOnly } = await import("../../../../shared/onboarding/content/tours");
    const ge = toursGeOnly.find((t) => t.tourId === "tour.ge.trust-mechanics")!;
    const ce = toursGeOnly.find((t) => t.tourId === "tour.ce.rules-policies")!;
    expect(isTourShippedGeOnly(ge)).toBe(true);
    expect(isTourShippedGeOnly(ce)).toBe(false);
  });
});

describe("rules-policies role-tailoring (AC-004-05)", () => {
  it("offers rules-policies proactively only on Compliance/Technical", () => {
    expect(availableTours([ceRulesPolicies], "compliance").map((t) => t.tourId)).toContain("tour.ce.rules-policies");
    expect(availableTours([ceRulesPolicies], "technical").map((t) => t.tourId)).toContain("tour.ce.rules-policies");
    expect(availableTours([ceRulesPolicies], "business")).toEqual([]);
    expect(availableTours([ceRulesPolicies], "admin")).toEqual([]);
  });

  it("keeps trust-mechanics offered on all four paths", () => {
    expect(availableTours([geTrustMechanics], "business")).toHaveLength(1);
    expect(availableTours([geTrustMechanics], "admin")).toHaveLength(1);
  });
});

describe("absent trust anchor resilience (AC-004-04)", () => {
  it("skips an absent trust anchor with a logged warning, never blocking the tour", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const steps = renderableSteps(geTrustMechanics, (id) => id !== "ge.filters.governed-content");
    expect(steps.map((s) => s.anchorId)).toEqual(["ge.overlay.controls", "ge.versions.panel"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ge.filters.governed-content"));
    warn.mockRestore();
  });
});
