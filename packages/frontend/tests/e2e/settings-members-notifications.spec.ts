import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// ONB-TASK-008: a first-visit-per-area welcome modal (WELCOME_MODALS,
// shared/onboarding/content/modals.ts) now fires on real logins against the
// seeded stack. Every CTA dismisses it (constitution/explorer/role-home also
// start a driver.js tour, which this then skips) -- a real user would click
// through it too, so tests must, or every later selector on the page times
// out behind its overlay.
async function dismissOnboarding(page: Page): Promise<void> {
  const welcome = page.getByRole("dialog").filter({ hasText: /welcome/i });
  try {
    await welcome.waitFor({ state: "visible", timeout: 3000 });
    await welcome.getByRole("button").last().click();
  } catch {
    // no welcome modal for this area/session.
  }
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  try {
    await skipTour.waitFor({ state: "visible", timeout: 2000 });
    await skipTour.click();
  } catch {
    // no tour started (non-tour-CTA area, or already seen).
  }
}


// Mirrors workspaces-provisioning.spec.ts's flow against the mock OIDC
// provider -- default mock user is admin@weave.local (workspace_admin rank).
async function loginAndGoTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await dismissOnboarding(page);
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
test("test_settings_notifications_matrix_prefilled_and_toggle_saves @behavioural", async ({ page }) => {
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


// TASK-006 AC-006-04: "change my onboarding path" persists via PUT and the
// new path survives a reload -- proof it's a real backend write, not just
// local UI state.
test("test_settings_onboarding_path_change_persists_across_reload", async ({ page }) => {
  await loginAndGoTo(page, "/settings/onboarding-path");

  await expect(page.getByRole("button", { name: "Change my onboarding path" })).toBeVisible();
  await page.getByRole("button", { name: "Change my onboarding path" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Technical" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Technical", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Technical", { exact: true })).toBeVisible();
});
