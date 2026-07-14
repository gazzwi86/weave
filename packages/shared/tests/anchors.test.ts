import { describe, expect, it } from "vitest";
import { ANCHORS, anchorIds } from "../onboarding/anchors";

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

  it("carries phase-tagged entries for known M2/post-v1 surfaces, most still unshipped", () => {
    // ONB-V1-TASK-002 plants ge.overlay.controls/ge.overlay.completeness-legend and ships them in
    // the same PR as their data-tour-id attributes (ADR-008) -- every other m2-or-later anchor
    // stays false until its own planting task lands.
    const m2OrLater = Object.values(ANCHORS).filter((a) => a.phase !== "m1");
    expect(m2OrLater.length).toBeGreaterThan(0);
    expect(m2OrLater.some((a) => a.shipped)).toBe(true);
    expect(m2OrLater.some((a) => !a.shipped)).toBe(true);
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

  it("registers exactly the 11 m2-delta §3 anchors (AC-001-01)", () => {
    expect(M2_ANCHOR_IDS).toHaveLength(11);
    expect(M2_ANCHOR_IDS.every((id) => id in ANCHORS)).toBe(true);
  });

  // ONB-V1-TASK-002 ships its two GE anchors, and ONB-V1-TASK-003 ships the 5
  // role-home anchors, in the same PR as their data-tour-id attributes
  // (ADR-008 atomicity) -- everything else in the m2-delta §3 set stays unshipped until its own
  // planting task lands.
  const SHIPPED_M2_ANCHOR_IDS = [
    "ge.overlay.controls",
    "ge.overlay.completeness-legend",
    "plat.role-home.nav-entry",
    "plat.role-home.capabilities",
    "plat.role-home.completeness-map",
    "plat.role-home.next-action",
    "plat.role-home.summary-tiles",
  ];

  it.each(M2_ANCHOR_IDS)("m2 anchor %s has an owning planted_by task", (id) => {
    const anchor = ANCHORS[id as keyof typeof ANCHORS];
    expect(anchor.phase).toBe("m2");
    expect(anchor.shipped).toBe(SHIPPED_M2_ANCHOR_IDS.includes(id));
    expect(anchor.planted_by).toMatch(/^TASK-00[234]$/);
  });
});

describe("ANCHORS registry -- m2 append-only edge cases", () => {
  it("the 11 m2-delta anchors are all distinct and none collide with an m1 id (append-only, AC-001-01)", () => {
    // Edge case: a copy/paste of an m2 entry onto an m1 id, or a duplicate id within the m2 set,
    // would silently overwrite a registry key (object-literal semantics swallow the collision at
    // runtime -- TS only catches it for literal duplicate keys in the same object, not across an
    // appended id vs a pre-existing one referenced via a different variable).
    const uniqueIds = new Set(M2_ANCHOR_IDS);
    expect(uniqueIds.size).toBe(M2_ANCHOR_IDS.length);

    const m1Ids = Object.entries(ANCHORS)
      .filter(([, a]) => a.phase === "m1")
      .map(([id]) => id);
    for (const id of M2_ANCHOR_IDS) {
      expect(m1Ids).not.toContain(id);
    }
  });
});
