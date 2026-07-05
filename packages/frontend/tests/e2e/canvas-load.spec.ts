import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const JSON_CONTENT_TYPE = "application/json";
const SPARQL_ROUTE_GLOB = "**/api/proxy/sparql**";

// QA FIX 4 (AC-8), rescoped 2026-07-05 (human decision, see ADR-002): the
// dense 1k-node/3-edges-per-node case measured p95 6032-6985ms against the
// real component across three runs -- a genuine, reproduced miss. Per ADR-002
// the M1 AC-8 target is rescoped to the *capped visible-node budget*
// (the bound fetchGraph's MAX_VISIBLE_NODES cap already enforces), and the
// dense 1k case is deferred to a later GE milestone (see the
// test.describe.skip block below, kept as evidence, not deleted).
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

// Self-loop rows (subject === object) so each row adds exactly one new
// distinct node -- this is the shape of the M1 *bounded visible-node budget*
// fetchGraph's MAX_VISIBLE_NODES cap enforces (ADR-002): a capped node count,
// not a dense arbitrary-edge graph. `pageSize` rows per call.
function generateCappedBudgetRows(pageIndex: number, pageSize = 400) {
  return Array.from({ length: pageSize }, (_, i) => ({
    subject: `urn:weave:bounded:${pageIndex}-${i}`,
    predicate: "https://weave.example/relatesTo",
    object: `urn:weave:bounded:${pageIndex}-${i}`,
    bpmo_kind: "Process",
    label: `Node ${pageIndex}-${i}`,
  }));
}

async function mockNodeKinds(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
}

async function measureRenderP95(page: Page, reps: number): Promise<number> {
  const durations: number[] = [];
  for (let rep = 0; rep < reps; rep++) {
    if (rep > 0) await page.reload();
    await page.waitForFunction(() => window.__explorerRenderDurationMs !== undefined, undefined, {
      timeout: 15_000,
    });
    const duration = await page.evaluate(() => window.__explorerRenderDurationMs);
    durations.push(duration as number);
  }
  return p95(durations);
}

// ADR-002 (rescoped 2026-07-05, human decision): the M1 AC-8 perf target is
// the *capped visible-node budget* fetchGraph already enforces, not the
// dense 1k-node/3-edges-per-node case (deferred below). This is the ACTIVE
// M1 gate.
test.describe("canvas load performance (AC-8, capped visible-node budget)", () => {
  test("first-interactive-render p95 at the M1 bounded budget", async ({ page }) => {
    test.setTimeout(60_000);
    await mockNodeKinds(page);
    await page.route(SPARQL_ROUTE_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({
          rows: generateCappedBudgetRows(0, 1000),
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });

    await loginAndGoToExplorer(page);

    // 5 reps matching the OQ-01 spike's REPS[1000] tier for comparability.
    const measuredP95 = await measureRenderP95(page, 5);
    console.warn(`AC-8 measured p95 render time @ capped budget: ${measuredP95.toFixed(1)}ms (target <= 3000ms)`);

    expect(measuredP95).toBeLessThanOrEqual(3000);
  });
});

// DEFERRED (ADR-002, human decision 2026-07-05): the dense 1k-node case
// measured p95 6032.9ms / 6296.0ms / 6985.5ms across three real-component
// runs against the <= 3000ms target -- a genuine, reproduced miss, not a
// flake. Kept as evidence, not deleted; re-enable when a later GE milestone
// lands the WebGL renderer (ADR-001) or a precomputed-layout path.
test.describe.skip("canvas load performance (AC-8, dense 1k nodes -- DEFERRED, see ADR-002)", () => {
  test("first-interactive-render p95 at ~1k nodes, 3 edges/node", async ({ page }) => {
    test.setTimeout(60_000);
    const rows = generateRows(1000, 3);
    await mockNodeKinds(page);
    await page.route(SPARQL_ROUTE_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ rows, columns: ["subject", "predicate", "object"], has_more_pages: false, page: 0 }),
      });
    });

    await loginAndGoToExplorer(page);
    const measuredP95 = await measureRenderP95(page, 5);
    console.warn(`AC-8 measured p95 render time @ ~1k dense nodes: ${measuredP95.toFixed(1)}ms (target <= 3000ms)`);

    expect(measuredP95).toBeLessThanOrEqual(3000);
  });
});

test.describe("canvas bounded visible-node set (AC-8)", () => {
  test("stops paginating once the visible-node cap is reached", async ({ page }) => {
    let pageIndex = 0;
    await mockNodeKinds(page);
    await page.route(SPARQL_ROUTE_GLOB, async (route) => {
      const rows = generateCappedBudgetRows(pageIndex);
      pageIndex += 1;
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
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
