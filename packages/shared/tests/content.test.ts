import { describe, expect, it } from "vitest";
import { runAllContentChecks } from "../onboarding/checks/run-all";
import { auditAnchors } from "../onboarding/checks/audit";
import { ANCHORS } from "../onboarding/anchors";

describe("real M1 content", () => {
  it("passes every content-config CI check (all ACs, own green test)", () => {
    expect(runAllContentChecks()).toEqual([]);
  });

  it("passes the anchor audit against an empty frontend tree -- TASK-003 plants no attributes", () => {
    const result = auditAnchors(ANCHORS, new Set());
    expect(result.ok).toBe(true);
  });
});
