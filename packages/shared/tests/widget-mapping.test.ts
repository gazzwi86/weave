import { describe, expect, it } from "vitest";
import { WIDGET_MAPPING } from "../onboarding/content/widget-mapping";

describe("WIDGET_MAPPING (AC-003-07)", () => {
  it("exposes a widget set for every role path", () => {
    for (const path of ["business", "technical", "compliance", "admin"] as const) {
      expect(WIDGET_MAPPING[path]?.length).toBeGreaterThan(0);
    }
  });

  it("every widget carries an engine-availability tag", () => {
    for (const widgets of Object.values(WIDGET_MAPPING)) {
      for (const w of widgets ?? []) {
        expect(["shipped", "m2", "post-v1"]).toContain(w.availability);
      }
    }
  });

  it("tags the CE-METRICS-1-backed Business tiles m2 (graceful-omit until CE M2)", () => {
    for (const widgetId of ["ontology-health", "graph-completeness"]) {
      const tile = WIDGET_MAPPING.business?.find((w) => w.widgetId === widgetId);
      expect(tile?.availability).toBe("m2");
    }
  });

  it("AC-014-02: each role path carries FR-015's widget list verbatim", () => {
    const expected = {
      business: ["ontology-health", "graph-completeness"],
      technical: ["token-spend", "active-projects", "agent-activity"],
      compliance: ["compliance-status", "audit-feed", "self-improvement-findings"],
      admin: ["rbac-coverage", "connector-health", "onboarding-progress"],
    } as const;

    for (const [path, widgetIds] of Object.entries(expected)) {
      const ids = WIDGET_MAPPING[path as keyof typeof expected]?.map((w) => w.widgetId);
      expect(ids).toEqual(widgetIds);
    }
  });
});
