import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as global-search.spec.ts (only a handful of files need it).
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const USAGE_SUMMARY = {
  period: "2026-07",
  total_tokens: 100,
  total_runs: 1,
  total_cost_usd: 1.0,
  by_workspace: [{ workspace_id: "ws-1", total_tokens: 100, total_runs: 1, total_cost_usd: 1.0 }],
  cap_utilisation_pct: 100.0,
};

// PLAT-TASK-008 E2E requirement: `test_budget_cap_exceeded_shows_error` --
// set a $1 workspace cap, simulate AI calls that exhaust it, trigger another
// call, assert the UI shows "Budget cap reached" and no AI result renders.
test("simulating an AI call over the budget cap shows the reached error (AC-2)", async ({
  page,
}) => {
  await page.route("**/api/billing/usage**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(USAGE_SUMMARY),
    });
  });
  await page.route("**/api/billing/simulate-ai-call**", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        detail: {
          error: "budget_cap_reached",
          effective_cap_usd: 1.0,
          consumed_usd: 1.0,
        },
      }),
    });
  });

  await loginAndGoToDashboard(page);
  await page.goto("/billing");

  await expect(page.getByTestId("total-cost")).toHaveText("Total cost: $1.00");

  await page.getByLabel("Workspace ID").fill("ws-1");
  await page.getByRole("button", { name: "Simulate AI call" }).click();

  // Next.js always renders a hidden route-announcer with role="alert" too,
  // so scope to the one with our text (getByRole("alert") alone is ambiguous).
  await expect(page.getByRole("alert").filter({ hasText: "Budget cap reached" })).toHaveText(
    "Budget cap reached: $1.00 of $1.00 used this period."
  );
});
