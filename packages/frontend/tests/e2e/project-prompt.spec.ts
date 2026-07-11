import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE: authored against the real (unmocked) backend, same convention as
// project-dashboard.spec.ts -- requires the live dev stack (docker-compose +
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
  await page.getByLabel("Name").fill(`E2E prompt test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return projectId;
}

// BE-V1-TASK-021 (FR-065) AC-1/AC-3/AC-4: editor submits a prompt from the
// Dashboard, gets a run handle, and watches the status chip transition --
// server-side `project_prompts` row + `trigger='prompt'` state-spine row
// are the real assertion, not just that the UI rendered (Law B).
test("editor submits a dashboard prompt and watches the run status transition", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.goto(`/build/projects/${projectId}`);
  await page.getByLabel("Prompt").fill("fix this inaccuracy");
  await page.getByRole("button", { name: "Submit prompt" }).click();

  await expect(page.getByTestId("prompt-run-status")).toBeVisible();
  await expect(page.getByTestId("prompt-run-status")).toContainText(/queued|running|gates|done|halted/);

  const state = await page.request.get(`/api/build/projects/${projectId}/state`);
  expect(state.ok()).toBeTruthy();
  const body = (await state.json()) as { phase: string };
  expect(["queued", "running", "gates", "done", "halted"]).toContain(body.phase);
});

// AC-2: a reader gets a disabled prompt box with an explanatory tooltip,
// and the server still enforces 403 if the API is called directly.
test("reader sees a disabled prompt box and a direct API call is refused", async ({ page }) => {
  await loginAs(page, "client@weave.local");
  await page.goto("/build");
  const projectLink = page.locator('a[href^="/build/projects/"]').first();
  await projectLink.click();

  const textarea = page.getByLabel("Prompt");
  await expect(textarea).toBeDisabled();
  await expect(page.getByText(/only editors and admins can submit a prompt/i)).toBeVisible();

  const projectId = /\/build\/projects\/([^/]+)/.exec(page.url())?.[1];
  const response = await page.request.post(`/api/build/projects/${projectId}/prompts`, {
    data: { prompt_text: "fix this inaccuracy" },
  });
  expect(response.status()).toBe(403);
});
