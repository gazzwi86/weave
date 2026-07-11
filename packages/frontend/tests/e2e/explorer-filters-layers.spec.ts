import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors explorer-domain-focus-expand-collapse.spec.ts's login + settle helpers.
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

async function waitOneAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
  await waitOneAnimationFrame(page);
  await waitOneAnimationFrame(page);
}

async function nodeInfo(page: Page, nodeId: string) {
  return page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
}

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }, { id: "Domain", label: "Domain", colour: "#10B981" }] };

const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/domain/create-account";

// AC-1: two nodes of different kinds, one edge between them -- enough to
// prove an entity-type toggle hides one kind and leaves the other alone.
const SPARQL_PAGE = {
  rows: [
    {
      subject: ONBOARDING,
      predicate: "https://weave.example/hasStep",
      object: CREATE_ACCOUNT,
      bpmo_kind: "Process",
      label: "Customer Onboarding",
    },
  ],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

async function mockGraphFetch(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(SPARQL_PAGE) });
  });
}

// AC-7 fixture: single-kind Process rows, self-loop edges only -- mirrors
// canvas-load.spec.ts's generateCappedBudgetRows (ADR-002's bounded
// visible-node fixture shape), paginated to MAX_VISIBLE_NODES.
function generateCappedBudgetRows(pageIndex: number, pageSize = 400) {
  return Array.from({ length: pageSize }, (_, i) => ({
    subject: `urn:weave:bounded:${pageIndex}-${i}`,
    predicate: "https://weave.example/relatesTo",
    object: `urn:weave:bounded:${pageIndex}-${i}`,
    bpmo_kind: "Process",
    label: `Node ${pageIndex}-${i}`,
  }));
}

test.describe("Filters & layers panel (TASK-020)", () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphFetch(page);
  });

  // AC-1/AC-2: toggling an entity type off real-hides (display:none) every
  // node of that kind; toggling back on restores it. Canvas node count is
  // asserted via the same __explorerNodeInfo dev hook every other explorer
  // E2E spec uses, since Cytoscape renders to <canvas> with no DOM to query.
  test("toggling an entity type off hides its nodes; toggling back on restores them (AC-1)", async ({ page }) => {
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await expect(page.getByTestId("explorer-filter-panel")).toBeVisible();
    await expect.poll(async () => (await nodeInfo(page, ONBOARDING))?.visible).toBe(true);

    await page.getByRole("checkbox", { name: "Process" }).click();
    await expect.poll(async () => (await nodeInfo(page, ONBOARDING))?.visible).toBe(false);

    await page.getByRole("checkbox", { name: "Process" }).click();
    await expect.poll(async () => (await nodeInfo(page, ONBOARDING))?.visible).toBe(true);
  });

  // AC-5/AC-8: builds one property filter without ever touching the mouse --
  // Tab between the path/comparison/value fields, activate "Add filter"
  // with the keyboard, and confirm the resulting non-match dims rather than
  // removes the node (AC-4/AC-5's opacity-only dim). This exercises the
  // missing-path branch (AC-5), not a real value match (AC-4) -- CE-READ-1
  // rows carry no key_properties yet (M1 bulk-graph-load gap, escalated,
  // reply pending), so real property-value assertions aren't fixture-able
  // until that lands.
  test("a keyboard-only property filter dims the non-matching node (AC-5/AC-8)", async ({ page }) => {
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await page.getByLabel("Property path").focus();
    await page.keyboard.type("status");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type("inactive");
    await page.getByRole("button", { name: "Add filter" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("status eq inactive")).toBeVisible();
    await expect.poll(async () => (await nodeInfo(page, ONBOARDING))?.opacity).toBeLessThan(1);
  });

  // AC-7 (rescoped, see ADR-002): the brief's "up to 10k loaded nodes" is
  // above the M1 bounded visible-node budget canvas-load.spec.ts's own
  // AC-8 perf gate already caps fetchGraph to (MAX_VISIBLE_NODES,
  // ~1000-1400 nodes) -- the same rescope canvas-load.spec.ts's dense-1k
  // case documents. Verifies the 300ms p95 budget at that capped ceiling
  // instead; flagged in the TASK-020 completion report as a spec/M1-cap
  // mismatch, not silently substituted.
  test("filter-apply reflow completes within 300ms p95 at the M1 bounded visible-node budget (AC-7)", async ({ page }) => {
    test.setTimeout(60_000);
    let pageIndex = 0;
    await page.route("**/api/proxy/sparql**", async (route) => {
      const rows = generateCappedBudgetRows(pageIndex);
      pageIndex += 1;
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ rows, columns: ["subject", "predicate", "object"], has_more_pages: true, page: pageIndex }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    const durations: number[] = [];
    for (let rep = 0; rep < 5; rep++) {
      await page.getByRole("checkbox", { name: "Process" }).click();
      const duration = await page.evaluate(() => window.__explorerFilterApplyDurationMs);
      durations.push(duration as number);
    }
    const sorted = [...durations].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;

    console.warn(`AC-7 measured p95 filter-apply time @ M1 bounded budget: ${p95.toFixed(1)}ms (target <= 300ms)`);
    expect(p95).toBeLessThanOrEqual(300);
  });
});
