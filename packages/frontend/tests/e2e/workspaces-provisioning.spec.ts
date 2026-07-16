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
  await dismissOnboarding(page);
}

// Provisioning panel against the real backend (no API mocks): the seeded
// workspace is listed, and creating one lands it in the list
// (backend-state proof: the reloaded list, not the form, shows it).
// ponytail: fixed slug, not `e2e-${Date.now()}` -- a run-unique slug leaks
// one junk workspace into the dev DB per run and there is no delete
// endpoint to clean up with. On re-runs the workspace already exists, so
// the create step is skipped and the assertion is the durable one: the
// backend lists it.
test("workspaces panel lists the seeded workspace and creates a new one @behavioural", async ({ page }) => {
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

  // Scenario 7, Law B: an independent read via the tenant-scoped workspaces
  // proxy (wraps the backend's GET /api/tenants/{tenant_id}/workspaces --
  // the client never addresses another tenant by path, so this proxy is the
  // only reachable form of that exact endpoint) confirms the new workspace,
  // not just the reloaded UI list above.
  const apiList = await page.request.get("/api/tenancy/workspaces");
  expect(apiList.ok()).toBe(true);
  const workspaces = (await apiList.json()) as { slug: string }[];
  expect(workspaces.some((w) => w.slug === slug)).toBe(true);
});
