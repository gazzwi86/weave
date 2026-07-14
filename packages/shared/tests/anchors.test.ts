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

  it("registers exactly the 11 m2-delta §3 anchors, each shipped:false with a planted_by owner (AC-001-01)", () => {
    const M2_ANCHOR_IDS = [
      "plat.role-home.nav-entry",
      "plat.role-home.capabilities",
      "plat.role-home.completeness-map",
      "plat.role-home.next-action",
      "plat.role-home.summary-tiles",
      "ge.overlay.controls",
      "ge.overlay.completeness-legend",
      "ge.versions.panel",
      "ge.filters.governed-content",
      "ce.rules.shape-list",
      "ce.rules.violation-report",
    ] as const;

    expect(M2_ANCHOR_IDS.length).toBe(11);
    for (const id of M2_ANCHOR_IDS) {
      const anchor = ANCHORS[id as keyof typeof ANCHORS];
      expect(anchor, `missing anchor "${id}"`).toBeDefined();
      expect(anchor.phase).toBe("m2");
      expect(anchor.shipped).toBe(false);
      expect(anchor.planted_by).toMatch(/^TASK-00[234]$/);
    }
  });
});
