import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts.
async function loginAndGoToBuild(page: Page): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
}

// Build engine intake: the form renders, and a "draft_spec_only" submission
// gets a 202 back with a request id and the "drafting" status. Deterministic
// without the model: POST /api/requests enqueues the drafting pipeline in the
// background and answers immediately -- we assert the accepted state only and
// never wait for the pipeline (it calls a local LLM and takes minutes).
test("build form renders and a draft_spec_only submission shows the drafting status", async ({
  page,
}) => {
  await loginAndGoToBuild(page);

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
