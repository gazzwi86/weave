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
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return decodeURIComponent(projectId);
}

// AC-1: the dashboard root renders all six tiles, each from its own
// per-tile endpoint -- reached from the Registry grid (project-card.tsx),
// not just by direct URL.
test("renders six tiles from per-tile endpoints, reachable from the project card", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.goto("/build");
  await page.getByRole("link", { name: new RegExp(`E2E dashboard test`) }).click();
  await expect(page).toHaveURL(new RegExp(`/build/projects/${projectId}$`));

  await expect(page.getByText("Demo readiness")).toBeVisible();
  await expect(page.getByText("Budget")).toBeVisible();
  await expect(page.getByText("Forecast")).toBeVisible();
  await expect(page.getByText("Tasks in flight")).toBeVisible();
  await expect(page.getByText("Blockers")).toBeVisible();
  await expect(page.getByText("Git ribbon")).toBeVisible();
});

// AC-2 (core isolation AC): stubbing one tile's endpoint down must never
// blank the page -- the other five tiles still render.
test("keeps five tiles alive when one endpoint is stubbed down", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.route(`**/api/build/projects/${projectId}/dashboard/budget`, (route) =>
    route.fulfill({ status: 503, body: JSON.stringify({ error: "down" }) })
  );

  await page.goto(`/build/projects/${projectId}`);

  await expect(page.getByText(/couldn't load/i)).toBeVisible();
  await expect(page.getByText("Demo readiness")).toBeVisible();
  await expect(page.getByText("Forecast")).toBeVisible();
  await expect(page.getByText("Tasks in flight")).toBeVisible();
  await expect(page.getByText("Blockers")).toBeVisible();
  await expect(page.getByText("Git ribbon")).toBeVisible();
});
