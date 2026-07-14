import { describe, expect, it } from "vitest";
import { ANCHORS } from "../onboarding/anchors";

// ONB-V1-TASK-005 AC-005-07 (ADR-008): the M2 release gate over exactly the
// m2-delta.md §3 registry (11 anchors, TASK-002/003/004-planted). Scoped to
// this named set, NOT every `phase: "m2"` entry in ANCHORS -- `ce.metrics-tile`
// also carries `phase: "m2"` but belongs to the OQ-M2-1-descoped CE
// count-flag (TASK-014, post-v1, m2-delta.md §1 OQ-M2-1 amendment), outside
// this epic's window; gating on it would red the release for something the
// spec explicitly deferred. If any of THESE 11 is shipped:false, that is a
// real finding (an in-window Must-Have surface genuinely unshipped) --
// never force-pass it here; the fix is landing the owning surface's task.
const M2_DELTA_SECTION_3_ANCHOR_IDS = [
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

describe("M2 shipped-gate (AC-005-07)", () => {
  it("every m2-delta §3 registry anchor is shipped:true", () => {
    const unshipped = M2_DELTA_SECTION_3_ANCHOR_IDS.filter((id) => !ANCHORS[id as keyof typeof ANCHORS].shipped);

    expect(unshipped).toEqual([]);
  });

  it("the m2-delta §3 registry has exactly 11 anchors (the gate isn't vacuously true)", () => {
    expect(M2_DELTA_SECTION_3_ANCHOR_IDS).toHaveLength(11);
    expect(M2_DELTA_SECTION_3_ANCHOR_IDS.every((id) => id in ANCHORS)).toBe(true);
  });
});
