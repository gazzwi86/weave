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
// workspace is listed, and creating one lands it in the list
// (backend-state proof: the reloaded list, not the form, shows it).
// ponytail: fixed slug, not `e2e-${Date.now()}` -- a run-unique slug leaks
// one junk workspace into the dev DB per run and there is no delete
// endpoint to clean up with. On re-runs the workspace already exists, so
// the create step is skipped and the assertion is the durable one: the
// backend lists it.
test("workspaces panel lists the seeded workspace and creates a new one", async ({ page }) => {
  await loginAndGoToWorkspaces(page);

  const rows = page.getByTestId("workspace-row");
  await expect(rows.filter({ hasText: "Demo Workspace" }).first()).toBeVisible();

  const slug = "e2e-sandbox";
  const existing = await rows.filter({ hasText: slug }).count();
  if (existing === 0) {
    await page.getByLabel("Display name").fill("E2E Sandbox");
    await page.getByLabel("Slug").fill(slug);
    await page.getByRole("button", { name: "Create workspace" }).click();
  }

  await expect(rows.filter({ hasText: slug })).toBeVisible();
});
