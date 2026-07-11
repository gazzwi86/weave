import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// AC-8 (binding tenancy ruling, R7): the header workspace switcher is
// retired entirely. These specs address the sandbox workspace by direct
// API call, never via member-visible UI (the ruling's explicit
// test-authoring constraint) -- there is no switcher control left to drive.
test.describe("workspace switcher retirement", () => {
  test("no header workspace switcher renders after sign-in", async ({ page }) => {
    await loginAndGoToDashboard(page);

    await expect(page.getByRole("combobox", { name: "Active workspace" })).toHaveCount(0);
  });

  // Switching remains reachable as server-side session state -- just no
  // longer through a header control. Direct API call proves the endpoint
  // still works for whatever surface (Settings -> Workspaces) drives it.
  test("switching the active workspace via direct API call still works", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const response = await page.request.post("/api/tenancy/workspaces/ws-demo/switch");
    expect(response.ok()).toBe(true);
  });
});
