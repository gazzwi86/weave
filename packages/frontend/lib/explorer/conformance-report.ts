/** ge-canvas-1.md's nine behavioural rules -> their named conformance test
 * titles (the "Behavioural semantics" table) -- single source, reused by
 * both the Playwright test titles (tests/e2e/ge-canvas-1-conformance.spec.ts)
 * and the report generator below, so the two can never drift apart. */
export const GE_CANVAS_1_RULE_TESTS: Record<number, string> = {
  1: "should render project slice when mounted with filterByIri",
  2: "should show empty state when filterByIri matches nothing",
  3: "should throw unsupported-mode error when mode is c4",
  4: "should force readonly when version is pinned",
  5: "should write back through CE-WRITE-1 when edited",
  6: "should return zero tenant-B entities under tenant-A JWT",
  7: "should persist embedded layout under source graph id",
  8: "should render boundary edges as stub markers without pulling in out-of-slice nodes",
  9: "should disable all edit affordances when readonly is true",
};

export type ConformanceStatus = "pass" | "fail";

export interface ConformanceRuleResult {
  rule: number;
  test: string;
  status: ConformanceStatus;
}

export interface ConformanceReport {
  generated_at: string;
  package_version: string;
  results: ConformanceRuleResult[];
}

/** AC-3: builds the machine-readable `rule -> test -> pass/fail` report --
 * the Build-M2 unblock evidence. `testStatuses` keys off the exact test
 * title (Playwright's `onTestEnd` gives this); a rule whose named test
 * never ran reports "fail" (missing coverage is not silently "pass"). */
export function buildConformanceReport(
  testStatuses: Record<string, ConformanceStatus>,
  packageVersion: string,
  generatedAt = new Date().toISOString()
): ConformanceReport {
  const results = Object.entries(GE_CANVAS_1_RULE_TESTS).map(([rule, test]) => ({
    rule: Number(rule),
    test,
    status: testStatuses[test] ?? "fail",
  }));
  return { generated_at: generatedAt, package_version: packageVersion, results };
}
