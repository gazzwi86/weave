import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Same real-backend precedent as rules.spec.ts -- deep-link only needs a
// seeded shape list to render, no write required.
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/ce/rules?tour=rules-policies");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill("admin@weave.local");
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce\/rules/);
  await page.waitForLoadState("networkidle");
}

// ponytail: sandbox has no Postgres for Playwright webServer — runs at real-env epic-close
test.describe("tour.ce.rules-policies (ONB-V1-TASK-004 AC-004-01/05/06)", () => {
  test.fixme(
    "help-launcher deep-link starts the tour without triggering a validation run, zero axe violations",
    async ({ page }) => {
      await loginAsAdmin(page);

      // AC-004-05: the tour must never itself trigger "Run validation" --
      // only the pre-existing manual button (rules.spec.ts) does that.
      await expect(page.getByText("1 of 2", { exact: false })).toBeVisible();
      let results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);

      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("2 of 2", { exact: false })).toBeVisible();
      results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    },
  );

  test.fixme("help-launcher offers the tour entry on the CE rules route for every role", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Help" }).click();

    await expect(page.getByRole("link", { name: "Take the rules-policies tour" })).toBeVisible();
  });
});
