import { describe, expect, it, vi } from "vitest";

// ONB-V1-TASK-004: generic `?tour=<value>` deep-link gate, shared by both
// new tours' hosts (explorer-tour.tsx for trust-mechanics, the CE rules
// host for rules-policies). Deliberately does NOT check `tour.paths` --
// unlike explorer-tour.ts's completeness-map gate -- because the
// help-launcher is the entry point for role paths excluded from proactive
// offering (AC-004-05: Business/Admin reach rules-policies this way), and
// gating the deep link too would make that launcher entry a dead CTA.
vi.mock("../../../../shared/onboarding/anchors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../shared/onboarding/anchors")>();
  return {
    ...actual,
    ANCHORS: {
      ...actual.ANCHORS,
      "ge.overlay.controls": { area: "explorer", shipped: true },
    },
  };
});

const { shouldAutoStartQueryTour } = await import("../tour-deep-link");
const { TOURS } = await import("../../../../shared/onboarding/content/tours");

const tour = TOURS.find((t) => t.tourId === "tour.ge.trust-mechanics")!;

describe("shouldAutoStartQueryTour", () => {
  it("starts when the query value matches and the tour is shipped", () => {
    expect(shouldAutoStartQueryTour("trust-mechanics", "trust-mechanics", tour)).toBe(true);
  });

  it("does not start for an unrelated or missing query param", () => {
    expect(shouldAutoStartQueryTour(null, "trust-mechanics", tour)).toBe(false);
    expect(shouldAutoStartQueryTour("something-else", "trust-mechanics", tour)).toBe(false);
  });
});
