import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// ONB-TASK-012: launcher entry point is TASK-013 (not built yet), so this
// spec navigates directly to the training library route -- same deviation
// pattern as role-home.spec.ts's documented gaps. Mirrors
// accessibility.spec.ts/role-home.spec.ts's mock-OIDC login flow.
async function loginAndGoToLibrary(page: Page): Promise<void> {
  await page.goto("/help/training");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/help\/training$/);
}

test.describe("training library (real browser)", () => {
  test("search filters content, a walkthrough opens, zero axe violations (AC-012-01/02/06)", async ({ page }) => {
    await loginAndGoToLibrary(page);

    await expect(page.getByRole("heading", { name: "Training library" })).toBeVisible();
    await expect(page.getByTestId("training-card")).not.toHaveCount(0);

    await page.getByRole("searchbox", { name: /search training/i }).fill("explorer");
    await expect(page.getByTestId("training-card")).toHaveCount(1);

    await page.getByRole("searchbox", { name: /search training/i }).fill("");
    const walkthroughLink = page.getByTestId("walkthrough-link").first();
    await expect(walkthroughLink).toBeVisible();
    await walkthroughLink.click();
    await expect(page.getByTestId("walkthrough-body")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
