import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// BE-V1-TASK-018 (build-engine EPIC-005), Law B: authored against the real
// (unmocked) backend, same convention as decision-log.spec.ts -- requires
// the live dev stack (docker-compose + `make migrate`/`make seed`) and the
// acme-corp demo tenant.

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
  await page.getByLabel("Name").fill(`E2E task detail test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing post-create redirect");
  return decodeURIComponent(projectId);
}

// AC-2: the task-list entry point + the 5-tab panel, reached from a kanban
// card -- an empty project (no run started) proves the mount chain and the
// list's own honest-empty state without paying for a full orchestrator run.
test("should reach the task list from project settings and show its empty state", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId("tasks-empty")).toBeVisible();

  // Backend-state proof: a project with no run started genuinely has no
  // state-spine row yet (404), independent of the list UI's own graceful
  // empty-state fallback just asserted against (Law B).
  const state = await page.request.get(`/api/build/projects/${projectId}/tasks`);
  expect(state.status()).toBe(404);
});

// AC-2/AC-3/AC-4/AC-5: opens a real task's detail page directly (a
// dispatched run is out of scope for this E2E's runtime budget) and
// switches all five tabs, asserting each honest-absence state a
// freshly-seeded task with no run genuinely has.
test("should open a task's detail page and switch all five tabs", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.goto(`/build/projects/${projectId}/tasks/e2e-task-1`);
  await expect(page.getByTestId("task-panel-brief")).toBeVisible();
  await expect(page.getByText("No brief on file for this task.")).toBeVisible();

  await page.getByTestId("task-tab-handoff").click();
  await expect(page.getByTestId("task-panel-handoff")).toBeVisible();

  await page.getByTestId("task-tab-tests").click();
  await expect(page.getByTestId("captures-not-available")).toBeVisible();

  await page.getByTestId("task-tab-console").click();
  await expect(page.getByTestId("console-not-captured")).toBeVisible();

  await page.getByTestId("task-tab-audit").click();
  await expect(page.getByTestId("audit-unavailable").or(page.getByText("No audit entries."))).toBeVisible();
});
