import { describe, expect, it } from "vitest";
import { TourSchema, TourStepSchema } from "../onboarding/content/schema";

describe("content schemas", () => {
  it("AC-003-01: accepts a registry anchor id", () => {
    const step = TourStepSchema.parse({
      anchorId: "ce.overview",
      titleKey: "onboarding.tour.ce-overview.step1.title",
      bodyKey: "onboarding.tour.ce-overview.step1.body",
    });
    expect(step.anchorId).toBe("ce.overview");
  });

  it("AC-003-01: rejects an unknown anchor id at parse time (zod/CI failure half)", () => {
    expect(() =>
      TourStepSchema.parse({
        anchorId: "not-a-real-anchor",
        titleKey: "x.y",
        bodyKey: "x.z",
      }),
    ).toThrow();
  });

  it("rejects a tour with zero steps", () => {
    expect(() =>
      TourSchema.parse({
        tourId: "t1",
        area: "constitution",
        paths: ["business"],
        phase: "m1",
        steps: [],
      }),
    ).toThrow();
  });
});
