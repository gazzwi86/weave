import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts. The default mock
// OIDC user is admin@weave.local, which the admin-only provisioning
// endpoint requires.
async function loginAndGoToWorkspaces(page: Page): Promise<void> {
  await page.goto("/settings/workspaces");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/settings\/workspaces$/);
}

// Provisioning panel against the real backend (no API mocks): the seeded
// workspace is listed, and creating one with a run-unique slug lands it in
// the list (backend-state proof: the reloaded list, not the form, shows it).
test("workspaces panel lists the seeded workspace and creates a new one", async ({ page }) => {
  await loginAndGoToWorkspaces(page);

  const rows = page.getByTestId("workspace-row");
  await expect(rows.filter({ hasText: "Demo Workspace" }).first()).toBeVisible();

  // Unique per run so re-runs never hit the 409 slug-taken path.
  const slug = `e2e-${Date.now()}`;
  await page.getByLabel("Display name").fill(`E2E ${slug}`);
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(rows.filter({ hasText: slug })).toBeVisible();
});
