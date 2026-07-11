import { execFileSync } from "node:child_process";
import { join } from "node:path";

// sonarjs/no-os-command-from-path: resolve an absolute path, not a bare
// "uv" that shells out via $PATH.
const UV_BIN = process.env.UV_BIN ?? join(process.env.HOME ?? "", ".local/bin/uv");

const LANES = ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"];
const BOARD_LANES_TESTID = "board-lanes";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// BE-V1-TASK-017 (build-engine EPIC-004): six-lane board, task tree,
// filters. Authored against the real (unmocked) backend -- same convention
// as project-settings.spec.ts -- requires live dev stack (docker-compose +
// migrate/seed) demo tenant (acme-corp: admin@weave.local).

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
  await page.getByLabel("Name").fill(`E2E board test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing post-create redirect");
  return decodeURIComponent(projectId);
}

/**
 * Seeds a state spine directly via Postgres (no dark-factory run -- Law F:
 * no real agent dispatch in test setup). Mirrors
 * `tests/integration/test_board_api.py::_seed_spine`.
 */
function seedStateSpine(projectIri: string): void {
  execFileSync(UV_BIN, ["run", "python", "scripts/seed_board_e2e.py", "acme-corp", projectIri], {
    cwd: "../backend",
    stdio: "inherit",
  });
}

test("board renders six lanes, tree flags missing dependency, filters narrow the set (Law B)", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);
  seedStateSpine(projectId);

  await page.goto(`/build/projects/${encodeURIComponent(projectId)}/board`);

  // AC-1: six lanes render, seeded cards land in the right lane.
  await expect(page.getByTestId(BOARD_LANES_TESTID)).toBeVisible();
  for (const lane of LANES) {
    await expect(page.getByTestId(`lane-${lane}`)).toBeVisible();
  }
  await expect(page.getByTestId("lane-Done")).toContainText("t-1");
  await expect(page.getByTestId("lane-Review")).toContainText("t-2");
  await expect(page.getByTestId("lane-Ready")).toContainText("t-3");

  // Law B: assert against real backend state, not just the DOM.
  const boardResponse = await page.request.get(`/api/projects/${encodeURIComponent(projectId)}/board`);
  expect(boardResponse.ok()).toBe(true);
  const boardBody = await boardResponse.json();
  expect(boardBody.lanes).toEqual(LANES);

  // AC-3: task tree flags the missing blocked_by predecessor instead of dropping it.
  await expect(page.getByText("t-missing")).toBeVisible();
  await expect(page.getByText("missing dependency")).toBeVisible();

  // AC-6: legend visible alongside colour coding.
  await expect(page.getByText("Backlog", { exact: true }).first()).toBeVisible();

  // AC-4: a filter that matches zero tasks shows the empty state, not a blank board.
  await page.getByRole("button", { name: "Blocked" }).click();
  await expect(page.getByTestId(BOARD_LANES_TESTID)).toBeHidden();
  await expect(page.getByRole("status")).toBeVisible();

  // AC-4 (continued): resetting to All narrows back to the full set.
  await page.getByRole("button", { name: "Back to All" }).click();
  await expect(page.getByTestId(BOARD_LANES_TESTID)).toBeVisible();

  // AC-5: an invalid/unknown filter in the URL is treated as the empty-state case.
  await page.goto(`/build/projects/${encodeURIComponent(projectId)}/board?filter=not-a-real-filter`);
  await expect(page.getByTestId(BOARD_LANES_TESTID)).toBeVisible();
});
