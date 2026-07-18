import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE: authored against the real (unmocked) backend, same convention as
// project-settings.spec.ts -- requires the live dev stack (docker-compose +
// `make migrate`/`make seed`) with the demo tenant (acme-corp).

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
  await page.getByLabel("Name").fill(`E2E dashboard test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  // Keep the URL-encoded form throughout -- it's what the Registry link's
  // href and every fetch actually use on the wire (project-card.tsx,
  // use-tile.ts both `encodeURIComponent` the raw IRI, which contains
  // colons).
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return projectId;
}

// refit-mock.html #sub-bld-dashboard: the KPI row + roadmap/spec-links +
// activity panels replace the earlier six-tile grid -- reached from the
// Registry grid (project-card.tsx), not just by direct URL.
test("renders the dashboard KPI row and spec links, reachable from the project card", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.goto("/build");
  await page.locator(`a[href="/build/projects/${projectId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/build/projects/${projectId}$`));

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("tasks created")).toBeVisible();
  await expect(page.getByText("tasks done")).toBeVisible();
  await expect(page.getByText("blocked — needs decision")).toBeVisible();
  await expect(page.getByText("epics created")).toBeVisible();
  await expect(page.getByText("Task briefs")).toBeVisible();
});

// A fresh project has no Review/QA lane cards -- the gate band (G12) stays
// absent rather than rendering a placeholder.
test("keeps the dashboard usable when the budget tile endpoint is stubbed down", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.route(`**/api/build/projects/${projectId}/dashboard/budget`, (route) =>
    route.fulfill({ status: 503, body: JSON.stringify({ error: "down" }) })
  );

  // Reach the dashboard via the same in-app navigation as the first test
  // (not a hard `page.goto`) -- keeps this in line with the app's real
  // usage pattern and the Registry-reachability assertion above.
  await page.goto("/build");
  await page.locator(`a[href="/build/projects/${projectId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/build/projects/${projectId}$`));

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("tasks created")).toBeVisible();
  await expect(page.getByText("budget", { exact: true })).toBeVisible();
});
