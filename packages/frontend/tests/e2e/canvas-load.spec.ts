import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// QA FIX 4 (AC-8): TASK-001's OQ-01 spike measured p95 5261ms at 1k nodes on
// a *bespoke standalone harness* (benchmarks/ge-oq01-spike/), not the real
// production component -- this is the first perf measurement against the
// actual ExplorerCanvas/useExplorerCanvas stack. If this also misses the
// 3000ms target, the assertion below must FAIL, not be weakened -- a
// truthful failing gate is the correct outcome (weakening a gate is never a
// valid fix).
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

const NODE_KINDS = {
  kinds: [
    { id: "Process", label: "Process", colour: "#3B82F6" },
    { id: "Actor", label: "Actor", colour: "#F59E0B" },
    { id: "System", label: "System", colour: "#10B981" },
  ],
};

// Mirrors benchmarks/ge-oq01-spike/fixtures/generate.mjs's shape
// (EDGES_PER_NODE=3, random non-self target) but as CE-READ-1 SPARQL rows
// (subject/predicate/object) rather than pre-built Cytoscape elements --
// this exercises the real fetchGraph -> mapRowsToElements path, not a
// bypass of it.
function generateRows(size: number, edgesPerNode: number) {
  const kinds = ["Process", "Actor", "System"];
  const rows = [];
  for (let i = 0; i < size; i++) {
    for (let e = 0; e < edgesPerNode; e++) {
      // eslint-disable-next-line sonarjs/pseudo-random -- fixture-graph edge shuffling, not security-sensitive
      const target = Math.floor(Math.random() * size);
      if (target === i) continue;
      rows.push({
        subject: `urn:weave:bench:node:${i}`,
        predicate: "https://weave.example/relatesTo",
        object: `urn:weave:bench:node:${target}`,
        bpmo_kind: kinds[i % kinds.length],
        label: `Node ${i}`,
      });
    }
  }
  return rows;
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

test.describe("canvas load performance (AC-8, real component)", () => {
  test("first-interactive-render p95 at ~1k nodes", async ({ page }) => {
    // 5 reps at ~1-6s each can exceed Playwright's 30s default -- this is
    // test-harness headroom, not a weakened assertion (still <= 3000ms below).
    test.setTimeout(60_000);
    const rows = generateRows(1000, 3);
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NODE_KINDS) });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rows, columns: ["subject", "predicate", "object"], has_more_pages: false, page: 0 }),
      });
    });

    await loginAndGoToExplorer(page);

    // 5 reps matching the OQ-01 spike's REPS[1000] tier, so the two p95
    // figures are comparable. Each rep re-triggers useExplorerCanvas's
    // load() via a full page reload (fresh mount, same mocked CE-READ-1).
    const REPS = 5;
    const durations: number[] = [];
    for (let rep = 0; rep < REPS; rep++) {
      if (rep > 0) await page.reload();
      await page.waitForFunction(() => window.__explorerRenderDurationMs !== undefined, undefined, {
        timeout: 15_000,
      });
      const duration = await page.evaluate(() => window.__explorerRenderDurationMs);
      durations.push(duration as number);
    }

    const measuredP95 = p95(durations);
    // AC-8 escalation path needs the measured number surfaced even when the
    // assertion below fails -- console.warn is allowed by lint config.
    console.warn(`AC-8 measured p95 render time @ ~1k nodes: ${measuredP95.toFixed(1)}ms (target <= 3000ms)`);

    expect(measuredP95).toBeLessThanOrEqual(3000);
  });
});

test.describe("canvas bounded visible-node set (AC-8)", () => {
  test("stops paginating once the visible-node cap is reached", async ({ page }) => {
    let pageIndex = 0;
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NODE_KINDS) });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      // Self-loop rows (subject === object) so each row adds exactly one new
      // distinct node -- an endless supply of pages, each reporting
      // has_more_pages: true, to prove the client (not the mock) is what
      // stops the loop.
      const rows = Array.from({ length: 400 }, (_, i) => ({
        subject: `urn:weave:bounded:${pageIndex}-${i}`,
        predicate: "https://weave.example/relatesTo",
        object: `urn:weave:bounded:${pageIndex}-${i}`,
        bpmo_kind: "Process",
        label: `Node ${pageIndex}-${i}`,
      }));
      pageIndex += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rows, columns: ["subject", "predicate", "object"], has_more_pages: true, page: pageIndex }),
      });
    });

    await loginAndGoToExplorer(page);
    await expect(page.getByTestId("explorer-canvas")).toBeVisible();

    const nodeCount = await page.evaluate(() => {
      const elements = window.__explorerElements ?? [];
      return new Set(elements.filter((el) => el.data.source === undefined).map((el) => el.data.id)).size;
    });

    // MAX_VISIBLE_NODES is 1000, checked at page boundaries (400/page) -- so
    // the real bound crossed is somewhere in the 1000-1400 range, well
    // within AC-8's "approximately 1-2k" bounded set and nowhere near an
    // unbounded fetch loop against a CE-READ-1 that never runs out.
    expect(nodeCount).toBeGreaterThanOrEqual(1000);
    expect(nodeCount).toBeLessThan(2000);
  });
});
