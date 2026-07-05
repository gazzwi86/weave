import { expect, test } from "@playwright/test";
import type { Page, Request } from "@playwright/test";

// Mirrors explorer-node-spotlight.spec.ts's login flow against the mock OIDC
// provider -- same duplication call as compliance.spec.ts/billing.spec.ts.
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
}

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] };
const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/step/create-account";
const GRAPH_ID = "whole-company";

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

async function mockLayoutPositions(page: Page, savedPositions: unknown[]): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route("**/api/proxy/layout-positions**", async (route) => {
    requests.push(route.request());
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({ positions: savedPositions }),
      });
      return;
    }
    await route.fulfill({ status: 204 });
  });
  return requests;
}

async function dragNode(page: Page, nodeId: string, to: { x: number; y: number }): Promise<void> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  if (!info) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.move(info.x, info.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

// GE-TASK-004: server-side layout persistence -- proves the real network
// round-trip (Next proxy <-> browser) rather than pixel-exact fcose
// settling, which the deterministic unit tests
// (use-explorer-canvas.test.ts/use-layout-persistence.test.ts) already
// cover with mocked fetches.
test.describe("Graph Explorer layout persistence (GE-TASK-004)", () => {
  test("dragging a node POSTs its new position to the layout-positions proxy (AC-1)", async ({ page }) => {
    await mockGraphFetch(page);
    const requests = await mockLayoutPositions(page, []);

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await dragNode(page, ONBOARDING, { x: 400, y: 300 });

    await expect
      .poll(() => requests.some((request) => request.method() === "POST"))
      .toBe(true);
    const saveRequest = requests.find((request) => request.method() === "POST");
    const body = saveRequest?.postDataJSON() as { graph_id: string; node_iri: string } | undefined;
    expect(body?.graph_id).toBe(GRAPH_ID);
    expect(body?.node_iri).toBe(ONBOARDING);
  });

  test("loading the Explorer fetches saved positions for the whole-company graph (AC-3/AC-5)", async ({ page }) => {
    await mockGraphFetch(page);
    const requests = await mockLayoutPositions(page, [
      { node_iri: ONBOARDING, position_x: 120, position_y: 80, locked: false },
    ]);

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    const getRequest = requests.find((request) => request.method() === "GET");
    expect(getRequest?.url()).toContain(`graph_id=${GRAPH_ID}`);
  });

  test("'Reset layout' clears saved positions via DELETE and re-randomizes (AC-4)", async ({ page }) => {
    await mockGraphFetch(page);
    const requests = await mockLayoutPositions(page, []);

    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await page.getByRole("button", { name: "Reset layout" }).click();

    await expect
      .poll(() => requests.some((request) => request.method() === "DELETE"))
      .toBe(true);
    const deleteRequest = requests.find((request) => request.method() === "DELETE");
    expect(deleteRequest?.url()).toContain(`graph_id=${GRAPH_ID}`);
  });
});
