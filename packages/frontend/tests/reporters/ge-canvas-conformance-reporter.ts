import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

import { buildConformanceReport, type ConformanceStatus } from "../../lib/explorer/conformance-report";

const OUTPUT_PATH = "test-results/ge-canvas-1-conformance-report.json";

// Playwright loads reporters as CommonJS (`import.meta` throws there), so
// this resolves package.json off process.cwd() (playwright.config.ts's own
// directory, per Playwright's docs) rather than import.meta.url.
function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version: string };
  return pkg.version;
}

/** AC-3: a tiny Playwright reporter -- collects the pass/fail of every test
 * whose title matches one of ge-canvas-1.md's nine named conformance tests
 * (tests/e2e/ge-canvas-1-conformance.spec.ts) and writes the
 * `rule -> test -> pass/fail` JSON artefact on suite end. No new
 * dependency -- wired via playwright.config.ts's existing `reporter` array. */
export default class GeCanvasConformanceReporter implements Reporter {
  private readonly statuses: Record<string, ConformanceStatus> = {};

  onTestEnd(test: TestCase, result: TestResult): void {
    this.statuses[test.title] = result.status === "passed" ? "pass" : "fail";
  }

  onEnd(_result: FullResult): void {
    const report = buildConformanceReport(this.statuses, readPackageVersion());
    mkdirSync("test-results", { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  }
}
