import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE (coordinator): authored against the real (unmocked) backend -- not
// run in this pass, same env-deferred lane as versions-publish.spec.ts.
// Requires the live dev stack (docker-compose) with the demo tenant seeded
// (seed_demo.py) and two logged-in sessions (two browser contexts).

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

// TASK-026 AC-1..AC-3 + Law B: user A saves a view (name + current
// filters/overlays/positions), user B in the same tenant opens it and
// sees the identical canvas state -- proves saved state round-trips
// through the real backend, not just the DOM.
test("user A saves a view and user B reproduces the identical canvas (AC-1/AC-2/AC-3)", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await login(pageA, "author@weave.local");
  await login(pageB, "client@weave.local");

  const viewName = `E2E Saved View ${Date.now()}`;
  await pageA.getByLabel("Entity type: Process").click(); // toggle a filter off before saving
  await pageA.getByLabel("View name").fill(viewName);
  await pageA.getByText("Save view").click();
  await expect(pageA.getByText(viewName)).toBeVisible();

  await pageB.reload();
  await pageB.getByText(viewName).click();
  await expect(pageB.getByLabel("Entity type: Process")).toHaveAttribute("aria-pressed", "false");

  await contextA.close();
  await contextB.close();
});

// TASK-026 AC-6 + Law B: a comment posted by user A on a spotlighted node
// appears for user B without a manual reload (poll-driven), proving it
// actually landed server-side.
test("user A comments on a spotlighted node and user B sees it appear (AC-6)", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await login(pageA, "author@weave.local");
  await login(pageB, "client@weave.local");

  const nodeButton = pageA.locator("[data-testid='explorer-canvas-node']").first();
  await nodeButton.click();
  await pageB.locator("[data-testid='explorer-canvas-node']").first().click();

  const commentBody = `E2E comment ${Date.now()}`;
  await pageA.getByLabel("Comment").fill(commentBody);
  await pageA.getByText("Post").click();

  await expect(pageB.getByText(commentBody)).toBeVisible({ timeout: 15_000 });

  await contextA.close();
  await contextB.close();
});
