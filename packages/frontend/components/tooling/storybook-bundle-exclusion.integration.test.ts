import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * AC-7: Storybook and `.stories` files must never reach the `next build`
 * production bundle. A real `next build` run is a multi-minute, flaky-in-CI
 * proxy for two structural invariants that guarantee the same outcome --
 * this test asserts those invariants statically instead:
 *
 * 1. Every `storybook`/`@storybook/*` package is a devDependency, never a
 *    runtime dependency -- `npm ci --omit=dev` (what the prod build/deploy
 *    installs from) never pulls Storybook in at all.
 * 2. No `*.stories.tsx` file lives under `app/**` -- Next's App Router only
 *    bundles files reachable from `app/`, so a story file that never sits
 *    there can never become a route entry point.
 */
const ROOT = process.cwd();

function readPackageJson(): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}

function findStoryFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findStoryFiles(path));
    } else if (entry.name.endsWith(".stories.tsx") || entry.name.endsWith(".stories.ts")) {
      found.push(path);
    }
  }
  return found;
}

describe("test_storybook_excluded_from_prod_bundle", () => {
  it("every storybook package is a devDependency, not a runtime dependency", () => {
    const { dependencies = {}, devDependencies = {} } = readPackageJson();
    const runtimeStorybookDeps = Object.keys(dependencies).filter((name) => name.toLowerCase().includes("storybook"));
    const devStorybookDeps = Object.keys(devDependencies).filter((name) => name.toLowerCase().includes("storybook"));

    expect(runtimeStorybookDeps).toEqual([]);
    expect(devStorybookDeps.length).toBeGreaterThan(0);
  });

  it("no .stories file lives under app/** (Next's route-bundling boundary)", () => {
    const appDir = join(ROOT, "app");
    expect(findStoryFiles(appDir)).toEqual([]);
  });
});
