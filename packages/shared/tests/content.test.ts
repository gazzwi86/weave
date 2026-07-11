import { describe, expect, it } from "vitest";
import { runAllContentChecks } from "../onboarding/checks/run-all";
import { auditAnchors } from "../onboarding/checks/audit";
import { ANCHORS } from "../onboarding/anchors";

describe("real M1 content", () => {
  it("passes every content-config CI check (all ACs, own green test)", () => {
    expect(runAllContentChecks()).toEqual([]);
  });

  it("passes the anchor audit when every shipped anchor's attribute is planted", () => {
    const shippedIds = Object.entries(ANCHORS)
      .filter(([, a]) => a.shipped)
      .map(([id]) => id);
    const result = auditAnchors(ANCHORS, new Set(shippedIds));
    expect(result.ok).toBe(true);
  });

  it("flags drift when a shipped anchor's attribute is missing from code (ADR-008)", () => {
    const result = auditAnchors(ANCHORS, new Set());
    expect(result.ok).toBe(false);
    expect(result.missingShipped.length).toBeGreaterThan(0);
  });
});
