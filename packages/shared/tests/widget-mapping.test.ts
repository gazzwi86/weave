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

  it("tags the Business CE-METRICS-1 tile m2 (graceful-omit until CE M2)", () => {
    const tile = WIDGET_MAPPING.business?.find((w) => w.widgetId === "CE-METRICS-1");
    expect(tile?.availability).toBe("m2");
  });
});
