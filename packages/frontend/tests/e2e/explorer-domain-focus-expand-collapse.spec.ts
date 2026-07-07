import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors explorer-node-spotlight.spec.ts's login + settle helpers.
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

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] };

const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/step/create-account";
const VENDOR_ONBOARDING = "https://weave.example/process/vendor-onboarding";
const VENDOR_STEP = "https://weave.example/step/vendor-step";
const NEW_NEIGHBOUR = "https://weave.example/step/new-neighbour";
const DOMAIN_MEMBERSHIP_PREDICATE = "https://weave.example/ontology/bpmo#memberOfDomain";

const SPARQL_PAGE = {
  rows: [
    {
      subject: ONBOARDING,
      predicate: "https://weave.example/hasStep",
      object: CREATE_ACCOUNT,
      // AC-3: canFocusDomain reads the cytoscape-loaded bpmoKind (from graph
      // load), not the CE-READ-1 resource fetch -- ONBOARDING must be a
      // Domain here for the "Focus domain" menu item to appear.
      bpmo_kind: "Domain",
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

const ce_resource_route = "**/api/proxy/ontology/resource/**";

async function mockGraphFetch(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
}

// A single sparql route serves both the initial graph page-load AND the
// domain-member-focus query -- distinguished by whether the posted query
// references the domain-membership predicate.
async function mockSparqlRoute(page: Page, domainMemberRows: Array<{ entity_iri: string; entity_label: string }>): Promise<void> {
  await page.route("**/api/proxy/sparql**", async (route) => {
    const body = route.request().postDataJSON() as { query: string } | null;
    const isDomainQuery = body?.query.includes(DOMAIN_MEMBERSHIP_PREDICATE) ?? false;
    const responseBody = isDomainQuery ? { rows: domainMemberRows } : SPARQL_PAGE;
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(responseBody) });
  });
}

async function clickNode(page: Page, nodeId: string): Promise<void> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  if (!info) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.click(info.x, info.y);
}

async function rightClickNode(page: Page, nodeId: string): Promise<void> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  if (!info) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.click(info.x, info.y, { button: "right" });
}

async function nodeOpacity(page: Page, nodeId: string): Promise<number | undefined> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  return info?.opacity;
}

async function nodeExists(page: Page, nodeId: string): Promise<boolean> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  return info !== undefined;
}

test.describe("Graph Explorer domain focus + neighbour expand/collapse (GE-TASK-005)", () => {
  test("right-click 'Focus domain' dims the canvas and restores only the domain's members (AC-1)", async ({ page }) => {
    await mockGraphFetch(page);
    await mockSparqlRoute(page, [{ entity_iri: ONBOARDING, entity_label: "Customer Onboarding" }]);
    await page.route(ce_resource_route, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({
          label: "Finance",
          type_label: "Domain",
          bpmo_kind: "Domain",
          key_properties: [],
          raw_iri: null,
          neighbours: [],
        }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await clickNode(page, ONBOARDING);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    // The panel testid renders during "loading" too (side-panel.tsx) -- a
    // right-click that lands before the CE-READ-1 resource fetch resolves
    // finds the context menu's isSpotlighted check still false (panel.status
    // !== "loaded"), so the menu silently never opens. Wait for the
    // loading placeholder to clear (panel reached "loaded"/"error"/"not-found")
    // before right-clicking, matching real usage (a network round-trip is
    // never sub-millisecond) rather than racing a same-tick mocked fetch.
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await rightClickNode(page, ONBOARDING);
    await page.getByRole("menuitem", { name: "Focus domain" }).click();

    await expect.poll(() => nodeOpacity(page, ONBOARDING)).toBe(1);
    await expect.poll(() => nodeOpacity(page, VENDOR_ONBOARDING)).toBeCloseTo(0.18, 2);
  });

  test("right-click 'Expand neighbours' adds a new node reusing the side panel's fetch; 'Collapse neighbours' removes it (AC-3/AC-5)", async ({
    page,
  }) => {
    await mockGraphFetch(page);
    await mockSparqlRoute(page, []);
    let resourceCalls = 0;
    await page.route(ce_resource_route, async (route) => {
      resourceCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({
          label: "Customer Onboarding",
          type_label: "Process",
          bpmo_kind: "Process",
          key_properties: [],
          raw_iri: null,
          neighbours: [
            {
              iri: NEW_NEIGHBOUR,
              label: "New Neighbour",
              bpmo_kind: "Process",
              edge_predicate: "https://weave.example/hasStep",
              edge_direction: "outgoing",
            },
          ],
        }),
      });
    });

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    await clickNode(page, ONBOARDING);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    // Same panel-not-yet-"loaded" race as the AC-1 test above -- see comment
    // there. This test happened to win the race in earlier runs, but it's
    // the same unguarded assumption, so guard it here too.
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await rightClickNode(page, ONBOARDING);
    await page.getByRole("menuitem", { name: "Expand neighbours" }).click();

    await expect.poll(() => nodeExists(page, NEW_NEIGHBOUR)).toBe(true);
    expect(resourceCalls).toBe(1); // AC-3/AC-4: no second CE-READ-1 call for expand.

    await rightClickNode(page, ONBOARDING);
    await page.getByRole("menuitem", { name: "Collapse neighbours" }).click();

    await expect.poll(() => nodeExists(page, NEW_NEIGHBOUR)).toBe(false);
  });
});
