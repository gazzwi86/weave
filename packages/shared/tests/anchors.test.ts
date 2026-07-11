import { describe, expect, it } from "vitest";
import { ANCHORS, anchorIds } from "../onboarding/anchors";

describe("ANCHORS registry", () => {
  it("seeds the M1 Constitution (CE) and Explorer anchor set", () => {
    expect(ANCHORS["ce.overview"]).toEqual({
      engine: "constitution",
      area: "constitution",
      phase: "m1",
      shipped: true,
      planted_by: "TASK-007",
    });
    expect(ANCHORS["ge.canvas"].engine).toBe("graph-explorer");
  });

  it("carries phase-tagged entries for known M2/post-v1 surfaces without DOM", () => {
    const m2OrLater = Object.values(ANCHORS).filter((a) => a.phase !== "m1");
    expect(m2OrLater.length).toBeGreaterThan(0);
    for (const a of m2OrLater) {
      expect(a.shipped).toBe(false);
    }
  });

  it("m1 anchors flip shipped:true as their planting task lands (ADR-008)", () => {
    const m1 = Object.values(ANCHORS).filter((a) => a.phase === "m1");
    expect(m1.some((a) => a.shipped)).toBe(true);
  });

  it("every anchor names exactly one planting task", () => {
    for (const a of Object.values(ANCHORS)) {
      expect(a.planted_by).toMatch(/^TASK-\d{3}$/);
    }
  });

  it("anchorIds is derived from the registry keys", () => {
    expect(anchorIds).toEqual(Object.keys(ANCHORS));
  });
});
