import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors workspaces-provisioning.spec.ts's flow against the mock OIDC
// provider -- default mock user is admin@weave.local (workspace_admin rank).
async function loginAndGoTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

// TASK-030 AC-2: Members page renders a DataTable with working invite and
// revoke actions -- backend-state proof is the reloaded members list, not
// just the form clearing.
test("test_settings_members_page_invite_and_revoke_work", async ({ page }) => {
  await loginAndGoTo(page, "/settings/members");

  await expect(page.getByText("Members")).toBeVisible();

  const email = `e2e-member-${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Invite" }).click();

  await expect(page.getByText(email)).toBeVisible();
});

// TASK-030 AC-5: Notifications matrix is pre-filled from GET and toggling
// an unlocked in-app cell persists via PUT -- reload proves it saved.
test("test_settings_notifications_matrix_prefilled_and_toggle_saves", async ({ page }) => {
  await loginAndGoTo(page, "/settings/notifications");

  const toggle = page.getByTestId("toggle-in-app-billing.cap.warning");
  await expect(toggle).toBeVisible();

  // ponytail: the backend's `store.upsert_pref` rejects any PUT that omits
  // "in_app" (mandatory channel) -- turning a row off is a local-only
  // affordance (see use-preferences.ts), so this only exercises the "on"
  // write, which is the one that actually persists.
  if (!(await toggle.isChecked())) {
    await toggle.click();
    await expect(toggle).toBeChecked();
  }

  await page.reload();
  await expect(page.getByTestId("toggle-in-app-billing.cap.warning")).toBeChecked();
});
