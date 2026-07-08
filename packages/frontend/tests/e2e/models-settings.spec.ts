import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts. The default mock
// OIDC user is admin@weave.local, which `PUT /api/billing/caps` requires.
async function loginAndGoToModels(page: Page): Promise<void> {
  await page.goto("/settings/models");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/settings\/models$/);
}

// Settings -> Models & AI: the fixed two-tier routing is informational and
// the budget-cap form drives the real `PUT /api/billing/caps` (no API mocks).
test("models settings shows both routing tiers and sets a company-wide cap", async ({ page }) => {
  await loginAndGoToModels(page);

  await expect(page.getByTestId("routing-fable")).toContainText("claude-fable-5");
  await expect(page.getByTestId("routing-sonnet")).toContainText("claude-sonnet-5");

  // Scope select defaults to company-wide; only the amount is needed.
  await page.getByLabel("Cap amount (USD)").fill("100");
  await page.getByRole("button", { name: "Set cap" }).click();

  await expect(page.getByTestId("cap-result")).toContainText("Cap set");
});
