import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// TASK-020 (build-engine EPIC-007), Law B: authored against the real
// (unmocked) backend, same convention as project-settings.spec.ts --
// requires the live dev stack (docker-compose + `make migrate`/`make
// seed`) and the acme-corp demo tenant.

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
  await page.getByLabel("Name").fill(`E2E decision log test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing post-create redirect");
  return decodeURIComponent(projectId);
}

// TASK-020 AC-1/AC-8, Law B: the log renders a real PLAT-AUDIT-1 row emitted
// by a genuine backend-mutating action (source control configure), then
// re-queries the server -- not a client-side row hide -- when the kind
// filter and search box narrow the results.
test("should search and filter the decision log against real audit rows", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.getByRole("tab", { name: "Source control" }).click();
  await page.getByLabel(/provider/i).selectOption("github");
  await page.getByLabel(/token/i).fill(`ghp_e2e-declog-${Date.now()}`);
  await page.getByRole("button", { name: /configure|save/i }).click();
  await expect(page.getByText(/weave\/.+\/token/)).toBeVisible();

  // Backend-state proof this event is real, independent of the log UI
  // we're about to assert against.
  const seeded = await page.request.get(`/api/build/projects/${projectId}/source-control`);
  expect((await seeded.json()).provider).toBe("github");

  await page.getByRole("link", { name: "Decision log" }).click();
  await expect(page).toHaveURL(/\/decisions$/);

  // Default kind filter is "decision" -- source-control config classifies
  // as "system" (audit/decisions.py's classify_kind), so it's absent here.
  await expect(page.getByTestId("decisions-empty")).toBeVisible();

  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText("build.source_control.configured")).toBeVisible();

  await page.getByLabel("Search decision log").fill("source_control");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("build.source_control.configured")).toBeVisible();

  await page.getByLabel("Search decision log").fill("no-such-event-xyz");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("decisions-empty")).toBeVisible();
});
