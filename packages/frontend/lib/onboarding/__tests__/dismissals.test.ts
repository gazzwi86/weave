import { describe, expect, it, vi } from "vitest";

import type { WelcomeModal } from "../../../../shared/onboarding/content/schema";

vi.mock("../../../../shared/onboarding/anchors", () => ({
  ANCHORS: {
    "ce.overview": { area: "constitution", shipped: true },
    "compliance.page": { area: "compliance", shipped: false },
    "settings.page": { area: "settings", shipped: true },
  },
}));

const { isDismissed, isAreaShipped, ctaLabelKeys } = await import("../dismissals");

const dismissals = [{ kind: "beacon" as const, ref_id: "ce-versions", dismissed_at: "2026-01-01T00:00:00Z" }];

describe("isDismissed (AC-008-02/04)", () => {
  it("is true when a matching (kind, ref_id) dismissal row exists", () => {
    expect(isDismissed(dismissals, "beacon", "ce-versions")).toBe(true);
  });

  it("is false when there is no matching row -- first-visit detection is 'no dismissal row'", () => {
    expect(isDismissed(dismissals, "welcome_modal", "welcome-constitution")).toBe(false);
  });
});

describe("isAreaShipped (AC-008-06)", () => {
  it("is true when at least one anchor for the area is shipped", () => {
    expect(isAreaShipped("constitution")).toBe(true);
    expect(isAreaShipped("settings")).toBe(true);
  });

  it("is false when no anchor for the area is shipped -- flagged-off area renders neither", () => {
    expect(isAreaShipped("compliance")).toBe(false);
  });

  it("is false for an area with no anchors at all", () => {
    expect(isAreaShipped("build")).toBe(false);
  });
});

describe("ctaLabelKeys (AC-008-05: no dead CTA)", () => {
  it("returns take-a-tour label for a tour CTA", () => {
    const modal: WelcomeModal = {
      modalId: "welcome-constitution",
      area: "constitution",
      titleKey: "t",
      bodyKey: "b",
      ctas: [{ kind: "tour", tourId: "ce-overview" }],
    };
    expect(ctaLabelKeys(modal)).toEqual(["onboarding.cta.take-a-tour"]);
  });

  it("returns the configured label key for a no-tour CTA (explore-freely/read-the-guide)", () => {
    const modal: WelcomeModal = {
      modalId: "welcome-compliance",
      area: "compliance",
      titleKey: "t",
      bodyKey: "b",
      ctas: [{ kind: "explore-freely", labelKey: "onboarding.cta.explore-freely" }],
    };
    expect(ctaLabelKeys(modal)).toEqual(["onboarding.cta.explore-freely"]);
  });
});
