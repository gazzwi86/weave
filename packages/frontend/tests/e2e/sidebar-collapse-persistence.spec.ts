import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Next dev-mode hydration lags the post-login navigation; without this,
  // a click can land before the sidebar's onClick handler is attached.
  await page.waitForLoadState("networkidle");
}

// AC-1: SecondarySidebar collapse state persists across a page reload.
// test_nav_rail_and_sidebar_collapse_persists
test("collapsing the SecondarySidebar survives a page reload", async ({ page }) => {
  await loginAndGoToDashboard(page);
  await page.goto("/ce/query");

  await expect(page.getByRole("navigation", { name: "Secondary" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("navigation", { name: "Secondary" })).toHaveCount(0);

  await page.reload();

  await expect(page.getByRole("navigation", { name: "Secondary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
});
