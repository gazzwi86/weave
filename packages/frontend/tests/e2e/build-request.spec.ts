import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts.
async function login(page: Page): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
}

// TASK-015 moved this request form under a project (/build/projects/[id]/request,
// EPIC-002's Registry now owns bare /build) -- create one via the Registry's
// "New project" modal (AC-8) to reach it, same as a real user would.
async function loginAndGoToBuildRequest(page: Page): Promise<void> {
  await login(page);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(`E2E request test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);

  const settingsUrl = page.url();
  const requestUrl = settingsUrl.replace(/\/settings$/, "/request");
  await page.goto(requestUrl);
}

// Build engine intake: the form renders, and a "draft_spec_only" submission
// gets a 202 back with a request id and the "drafting" status. Deterministic
// without the model: POST /api/requests enqueues the drafting pipeline in the
// background and answers immediately -- we assert the accepted state only and
// never wait for the pipeline (it calls a local LLM and takes minutes).
test("build form renders and a draft_spec_only submission shows the drafting status", async ({
  page,
}) => {
  await loginAndGoToBuildRequest(page);

  const prompt = page.getByLabel("What should Weave build?");
  const runMode = page.getByLabel("Run mode");
  await expect(prompt).toBeVisible();
  await expect(runMode).toBeVisible();

  await prompt.fill("An expense approval tracker for the finance team.");
  await runMode.selectOption("draft_spec_only");
  await page.getByRole("button", { name: "Request application" }).click();

  // Status card names the created request and its accepted state. The id is
  // a hex UUID, which keeps this from matching the "Request application"
  // heading/button (strict mode).
  await expect(page.getByTestId("request-status")).toContainText("drafting");
  await expect(page.getByText(/^Request [0-9a-f-]{16,}$/)).toBeVisible();
});

// TASK-024 (F-D20): the fuller intake -- name, grounding-entity typeahead
// selection, target repo name (only required once run_mode leaves
// draft_spec_only), all labelled fields per AC-1. Grounding-entity search
// hits real CE via /api/ontology/entities/typeahead; the seed/demo tenant
// may have zero matching entities, so this only asserts the picker renders
// and accepts a name/repo -- not that a specific entity is selectable.
test("build form collects name, target repo name, and grounding entities", async ({ page }) => {
  await loginAndGoToBuildRequest(page);

  await page.getByLabel("Request name").fill(`E2E named request ${Date.now()}`);
  await page.getByLabel("What should Weave build?").fill("A finance approvals tracker.");
  await page.getByLabel("Run mode").selectOption("spec_to_build");

  // Target repo name field only appears once run_mode requires it (AC-5).
  const repoField = page.getByLabel("Target repo name");
  await expect(repoField).toBeVisible();
  await repoField.fill("finance-approvals-tracker");

  const groundingInput = page.getByLabel("Grounding entities");
  await expect(groundingInput).toBeVisible();
  await groundingInput.fill("fi");

  await page.getByRole("button", { name: "Request application" }).click();

  await expect(page.getByTestId("request-status")).toContainText(/drafting|pending_approvals/);
});
