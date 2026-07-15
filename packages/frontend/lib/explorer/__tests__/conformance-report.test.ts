import { describe, expect, it } from "vitest";

import { buildConformanceReport, GE_CANVAS_1_RULE_TESTS } from "../conformance-report";

describe("buildConformanceReport (AC-3 conformance report artefact)", () => {
  it("emits one rule -> test -> pass/fail entry per named conformance test", () => {
    const allPass = Object.fromEntries(Object.values(GE_CANVAS_1_RULE_TESTS).map((test) => [test, "pass" as const]));
    const report = buildConformanceReport(allPass, "0.1.0", "2026-07-14T00:00:00.000Z");

    expect(report.generated_at).toBe("2026-07-14T00:00:00.000Z");
    expect(report.package_version).toBe("0.1.0");
    expect(report.results).toHaveLength(9);
    for (const entry of report.results) {
      expect(entry).toEqual({ rule: entry.rule, test: GE_CANVAS_1_RULE_TESTS[entry.rule], status: "pass" });
    }
  });

  it("reports fail for a rule whose named test never ran", () => {
    const report = buildConformanceReport({}, "0.1.0");
    expect(report.results.every((entry) => entry.status === "fail")).toBe(true);
  });
});
