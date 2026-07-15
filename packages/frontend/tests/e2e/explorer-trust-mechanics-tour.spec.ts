import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = {
  kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }],
  relTypes: [],
};

// Mirrors explorer-completeness-tour.spec.ts's mock + login helpers.
async function mockGraphFetch(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ rows: [], columns: ["subject", "predicate", "object"], has_more_pages: false, page: 0 }),
    });
  });
}

async function loginAndGoToExplorer(page: Page, query = ""): Promise<void> {
  await mockGraphFetch(page);
  await page.goto(`/explorer${query}`);
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer/);
}

// ponytail: sandbox has no Postgres for Playwright webServer — runs at real-env epic-close
test.describe("tour.ge.trust-mechanics (ONB-V1-TASK-004 AC-004-01/04/06)", () => {
  test.fixme("help-launcher deep-link starts the tour with a zero-violation axe pass per step", async ({ page }) => {
    await loginAndGoToExplorer(page, "?tour=trust-mechanics");

    await expect(page.getByText("1 of 3", { exact: false })).toBeVisible();
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("2 of 3", { exact: false })).toBeVisible();
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("3 of 3", { exact: false })).toBeVisible();
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test.fixme("help-launcher offers the tour entry only on Explorer routes", async ({ page }) => {
    await loginAndGoToExplorer(page);
    await page.getByRole("button", { name: "Help" }).click();

    await expect(page.getByRole("link", { name: "Take the trust-mechanics tour" })).toBeVisible();
  });
});
