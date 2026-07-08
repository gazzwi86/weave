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

test.describe("workspace switcher", () => {
  // Real backend: the top-bar switcher lists the seeded workspace.
  test("top bar shows the workspace select listing Demo Workspace", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const switcher = page.getByRole("combobox", { name: "Active workspace" });
    await expect(switcher).toBeVisible();
    await expect(
      switcher.locator("option", { hasText: "Demo Workspace" })
    ).toHaveCount(1);
  });

  // Switching is server-side session state followed by a full reload, so the
  // assertion stops at the POST firing (the reload's effect is workspace
  // re-scoping, covered by backend tests). Two mocked workspaces make the
  // change event deterministic regardless of what earlier runs provisioned.
  test("selecting another workspace fires the switch POST", async ({ page }) => {
    const workspaces = [
      { id: "ws-demo", slug: "demo", display_name: "Demo Workspace" },
      { id: "ws-other", slug: "other", display_name: "Other Workspace" },
    ];
    const captured: { switchedId: string | null } = { switchedId: null };

    await page.route("**/api/tenancy/workspaces", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(workspaces),
      });
    });
    await page.route("**/api/tenancy/workspaces/active", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workspace_id: "ws-demo" }),
      });
    });
    await page.route("**/api/tenancy/workspaces/*/switch", async (route) => {
      const match = /workspaces\/([^/]+)\/switch/.exec(route.request().url());
      captured.switchedId = match?.[1] ?? null;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await loginAndGoToDashboard(page);
    await page
      .getByRole("combobox", { name: "Active workspace" })
      .selectOption("ws-other");

    await expect.poll(() => captured.switchedId).toBe("ws-other");
  });
});
