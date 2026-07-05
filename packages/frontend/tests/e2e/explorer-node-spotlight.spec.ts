import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors explorer.spec.ts/canvas-load.spec.ts's login flow against the mock
// OIDC provider -- same duplication call as compliance.spec.ts/billing.spec.ts.
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

// Same real-settle wait as explorer.spec.ts -- DOM-polling risks a
// mid-animation false-stable read, so wait for the genuine `layoutstop`
// event surfaced via the dev-only window hook instead.
async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
  await waitOneAnimationFrame(page);
  await waitOneAnimationFrame(page);
}

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] };

// Two disconnected pairs: clicking ONBOARDING must dim VENDOR_ONBOARDING
// (no path between them) while leaving its own neighbour CREATE_ACCOUNT at
// full opacity -- this is what actually proves AC-1 dims *non*-neighbourhood
// rather than everything or nothing.
const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/step/create-account";
const VENDOR_ONBOARDING = "https://weave.example/process/vendor-onboarding";
const VENDOR_STEP = "https://weave.example/step/vendor-step";

const SPARQL_PAGE = {
  rows: [
    {
      subject: ONBOARDING,
      predicate: "https://weave.example/hasStep",
      object: CREATE_ACCOUNT,
      bpmo_kind: "Process",
      label: "Customer Onboarding",
    },
    {
      subject: VENDOR_ONBOARDING,
      predicate: "https://weave.example/hasStep",
      object: VENDOR_STEP,
      bpmo_kind: "Process",
      label: "Vendor Onboarding",
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

async function clickNode(page: Page, nodeId: string): Promise<void> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  if (!info) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.click(info.x, info.y);
}

async function nodeOpacity(page: Page, nodeId: string): Promise<number | undefined> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  return info?.opacity;
}

const ce_resource_route = "**/api/proxy/ontology/resource/**";

test.describe("Graph Explorer node spotlight + search overlay (GE-TASK-003)", () => {
  test("clicking a node spotlights its neighbourhood and fetches its properties via the proxy (AC-1/AC-2)", async ({
    page,
  }) => {
    await mockGraphFetch(page);
    await page.route(ce_resource_route, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({
          label: "Customer Onboarding",
          type_label: "Process",
          bpmo_kind: "Process",
          key_properties: [{ path: "owner", label: "Owner", value: "Ops Team" }],
          raw_iri: null,
        }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await clickNode(page, ONBOARDING);

    // AC-2: side panel renders the CE-READ-1 fetched properties.
    const panel = page.getByTestId("explorer-side-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Customer Onboarding")).toBeVisible();
    await expect(panel.getByText("Ops Team")).toBeVisible();
    // AC-2: no raw IRI section rendered for a non-ontologist role.
    await expect(panel.getByText("Advanced")).toHaveCount(0);

    // AC-1: the clicked node's own neighbour stays fully visible, the
    // disconnected pair dims to the configured spotlight opacity.
    await expect.poll(() => nodeOpacity(page, CREATE_ACCOUNT)).toBe(1);
    await expect.poll(() => nodeOpacity(page, VENDOR_ONBOARDING)).toBeCloseTo(0.18, 2);
  });

  test("a background click clears the spotlight and closes the panel, Escape does the same (AC-4)", async ({
    page,
  }) => {
    await mockGraphFetch(page);
    await page.route(ce_resource_route, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ label: "Customer Onboarding", type_label: "Process", key_properties: [], raw_iri: null }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await clickNode(page, ONBOARDING);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    await expect.poll(() => nodeOpacity(page, VENDOR_ONBOARDING)).toBeCloseTo(0.18, 2);

    const canvas = page.getByTestId("explorer-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");
    // Click a corner far from either rendered node -- a genuine background tap.
    await page.mouse.click(box.x + 5, box.y + 5);

    await expect(page.getByTestId("explorer-side-panel")).toHaveCount(0);
    await expect.poll(() => nodeOpacity(page, VENDOR_ONBOARDING)).toBe(1);

    await clickNode(page, ONBOARDING);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("explorer-side-panel")).toHaveCount(0);
  });

  test("a CE-READ-1 timeout falls back to a retryable error notice (AC-3)", async ({ page }) => {
    test.slow(); // waits out the real 10s AbortSignal.timeout default.
    await mockGraphFetch(page);
    // Never fulfil -- the browser's own AbortSignal.timeout(10_000) aborts
    // client-side regardless of whether the route ever responds.
    await page.route(ce_resource_route, () => {
      /* left hanging on purpose */
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await clickNode(page, ONBOARDING);

    const panel = page.getByTestId("explorer-side-panel");
    await expect(panel.getByText("Details unavailable")).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("Cmd/Ctrl+K opens a client-side search overlay that makes no CE-READ-1 call (AC-5)", async ({ page }) => {
    await mockGraphFetch(page);
    let resourceCalls = 0;
    await page.route(ce_resource_route, async (route) => {
      resourceCalls += 1;
      await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify({}) });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const overlay = page.getByTestId("explorer-search-overlay");
    await expect(overlay).toBeVisible();

    await overlay.getByPlaceholder("Search nodes…").fill("Vendor");
    await expect(overlay.getByText("Vendor Onboarding")).toBeVisible();

    expect(resourceCalls).toBe(0);
  });

  test("selecting a search result centres + spotlights it, and opens its side panel (AC-6)", async ({ page }) => {
    await mockGraphFetch(page);
    await page.route(ce_resource_route, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ label: "Vendor Onboarding", type_label: "Process", key_properties: [], raw_iri: null }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await page.getByTestId("explorer-search-button").click();
    const overlay = page.getByTestId("explorer-search-overlay");
    await overlay.getByPlaceholder("Search nodes…").fill("Vendor");
    await overlay.getByText("Vendor Onboarding").click();

    await expect(overlay).toHaveCount(0);
    const panel = page.getByTestId("explorer-side-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Vendor Onboarding")).toBeVisible();
    await expect.poll(() => nodeOpacity(page, ONBOARDING)).toBeCloseTo(0.18, 2);
    await expect.poll(() => nodeOpacity(page, VENDOR_STEP)).toBe(1);
  });

  test("a zero-match search shows 'No results found' and leaves canvas opacity untouched (AC-7)", async ({ page }) => {
    await mockGraphFetch(page);

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await page.getByTestId("explorer-search-button").click();
    const overlay = page.getByTestId("explorer-search-overlay");
    await overlay.getByPlaceholder("Search nodes…").fill("no-such-node-xyz");

    await expect(overlay.getByText("No results found")).toBeVisible();
    await expect.poll(() => nodeOpacity(page, ONBOARDING)).toBe(1);
    await expect.poll(() => nodeOpacity(page, VENDOR_ONBOARDING)).toBe(1);
  });
});
