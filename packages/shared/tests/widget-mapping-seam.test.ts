import { describe, expect, it } from "vitest";
import { ROLE_PATHS } from "../onboarding/role-paths";
import { WIDGET_MAPPING } from "../onboarding/content/widget-mapping";
import { WidgetMappingSchema } from "../onboarding/content/schema";

describe("widget mapping / Platform consumption seam (TASK-014)", () => {
  it("AC-014-04: fails CI (schema parse throws) when an entry lacks its availability tag", () => {
    expect(() =>
      WidgetMappingSchema.parse({
        business: [{ widgetId: "CE-OVERVIEW-1", engine: "constitution" }],
      }),
    ).toThrow();
  });

  it("AC-014-01/02: a stub Platform reader can resolve a role path to its widget list", () => {
    // Stands in for Platform E1-S6's own reader: given the path `GET
    // /api/onboarding/path` (TASK-006) resolves to, look up this mapping --
    // no endpoint of our own, per the task brief's implementation hint.
    function stubPlatformReader(resolvedPath: (typeof ROLE_PATHS)[number]) {
      return WIDGET_MAPPING[resolvedPath];
    }

    for (const path of ROLE_PATHS) {
      const widgets = stubPlatformReader(path);
      expect(widgets?.length).toBeGreaterThan(0);
      expect(widgets?.every((w) => ["shipped", "m2", "post-v1"].includes(w.availability))).toBe(true);
    }
  });
});
