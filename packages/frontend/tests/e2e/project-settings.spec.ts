import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE (coordinator): authored against the real (unmocked) backend, same
// convention as versions-publish.spec.ts -- requires the live dev stack
// (docker-compose + `make migrate`/`make seed`) with the demo tenant
// (acme-corp: admin@weave.local / client@weave.local, seed_demo.py).

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
}

async function createProject(page: Page): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(`E2E settings test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return decodeURIComponent(projectId);
}

// TASK-015 AC-2/AC-4, Law B: the settings PATCH actually changes backend
// state (not just the DOM) -- proven via an independent GET after save.
test("saving a governance change persists to the backend (Law B)", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.getByLabel("Model tier").selectOption("premium");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Backend-state proof: a fresh, independent read (not the page's own
  // fetch) shows the change actually persisted.
  const settings = await page.request.get(`/api/build/projects/${projectId}/settings`);
  expect(settings.ok()).toBe(true);
  const body = (await settings.json()) as { model_tier: string };
  expect(body.model_tier).toBe("premium");
});

// TASK-015 AC-4: a caller with no project-admin role sees the governance
// form read-only and cannot mutate it, even by direct URL visit.
test("a non-admin caller sees governance controls disabled", async ({ page, browser }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await loginAs(clientPage, "client@weave.local");
  await clientPage.goto(`/build/projects/${encodeURIComponent(projectId)}/settings`);

  await expect(clientPage.getByLabel("Model tier")).toBeVisible();
  await expect(clientPage.getByLabel("Model tier")).toBeDisabled();
  await expect(clientPage.getByRole("button", { name: "Save" })).toHaveCount(0);

  await clientContext.close();
});
