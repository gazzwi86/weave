import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors change-viz.spec.ts's login flow against the real mock OIDC
// provider + real uvicorn backend (SSR /dashboard fetches aren't
// interceptable by page.route, so login always goes through for real).
const PROMPT_INPUT_LABEL = "Describe the view you want";
const REFINE_INPUT_LABEL = "Refine this widget";

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

const GENERATED_SPEC = {
  component_type: "bar_chart",
  title: "Entities by kind, last 30 days",
  data_source_contracts: ["CE-METRICS-1"],
  bindings: { field: "entity_count_by_kind" },
  column_span: 6,
  data_shape: "categorical",
};

const REFINED_SPEC = {
  ...GENERATED_SPEC,
  title: "Entities by kind, split by severity",
  bindings: { field: "entity_count_by_kind_severity" },
};

function sseBody(spec: Record<string, unknown>, rows: Record<string, number>): string {
  const blocks = [
    `event: spec\ndata: ${JSON.stringify(spec)}`,
    `event: data\ndata: ${JSON.stringify({ rows, partial: false })}`,
    `event: done\ndata: ${JSON.stringify({ token_count: 42, widget_id: "w-refine-1" })}`,
  ];
  return blocks.join("\n\n") + "\n\n";
}

async function mockGenerate(page: Page): Promise<void> {
  await page.route("**/api/dashboard/widgets/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody(GENERATED_SPEC, { Person: 12, Process: 7 }),
    });
  });
}

/** Refine mock: first call (the "split by severity" prompt) succeeds;
 * every call after `failNext` is armed returns the SSE error grammar
 * instead -- proves AC-3 (failure preserves prior state) without a second
 * spy implementation.
 */
async function mockRefine(page: Page): Promise<{ armFailure: () => void; callCount: () => number }> {
  let shouldFail = false;
  let calls = 0;
  await page.route("**/api/dashboard/widgets/w-refine-1/refine", async (route) => {
    calls += 1;
    if (shouldFail) {
      const body =
        `event: error\ndata: ${JSON.stringify({ state: "provider_503", reason: "AI provider unavailable" })}\n\n`;
      await route.fulfill({ status: 200, contentType: "text/event-stream", body });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody(REFINED_SPEC, { Person: 12, Process: 7, Rule: 3 }),
    });
  });
  return { armFailure: () => { shouldFail = true; }, callCount: () => calls };
}

async function mockHistoryAndRestore(page: Page): Promise<void> {
  await page.route("**/api/dashboard/widgets/w-refine-1/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        steps: [{ seq: 1, prompt: "split by severity", created_at: "2026-07-11T00:00:00Z" }],
      }),
    });
  });
  await page.route("**/api/dashboard/widgets/w-refine-1/restore", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ spec: GENERATED_SPEC, status: "fresh", fetched_at: "2026-07-11T00:05:00Z" }),
    });
  });
}

// TASK-013 AC-1/AC-3/AC-4: `test_refine_and_step_back` -- generate a widget
// (mocked SSE, no live LLM per Plugin Law F), refine it with a follow-up
// prompt and confirm the widget updates, open history and restore step 1
// to confirm the original view returns, then force a failing refine and
// confirm the widget is left intact with a dismissible error notice
// (backend spec unchanged -- Plugin Law B: the mocked seam is the proof).
test("refine and step back: refine updates widget, restore returns original, failed refine preserves state (TASK-013)", async ({
  page,
}) => {
  await mockGenerate(page);
  const refine = await mockRefine(page);
  await mockHistoryAndRestore(page);

  await loginAndGoToDashboard(page);
  await page.getByTestId("prompt-bar-trigger").click();
  await page.getByLabel(PROMPT_INPUT_LABEL).fill("show entities by kind as a bar chart");
  await page.getByLabel(PROMPT_INPUT_LABEL).press("Enter");

  const status = page.getByTestId("prompt-bar-status");
  await expect(status).toContainText("Done", { timeout: 10_000 });

  // AC-1: refine on the just-generated (now-pinned) widget re-renders via
  // the same SSE grammar as generate.
  await page.getByLabel(REFINE_INPUT_LABEL).fill("split by severity");
  await page.getByRole("button", { name: "Refine" }).click();
  await expect(page.getByText("Entities by kind, split by severity")).toBeVisible();
  await expect(page.getByText("Rule")).toBeVisible();
  expect(refine.callCount()).toBe(1);

  // AC-4: restoring step 1 swaps the spec back with no model call (only
  // GET history + POST restore are mocked -- no /refine hit for this step).
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /split by severity/ }).click();
  await expect(page.getByText("Entities by kind, last 30 days")).toBeVisible();
  expect(refine.callCount()).toBe(1);

  // AC-3: a failing refine leaves the widget intact with a dismissible
  // error notice, never a blank or reverted tile.
  refine.armFailure();
  await page.getByLabel(REFINE_INPUT_LABEL).fill("break it");
  await page.getByRole("button", { name: "Refine" }).click();
  await expect(page.getByTestId("refine-bar-error")).toContainText("AI provider unavailable");
  await expect(page.getByText("Entities by kind, last 30 days")).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("refine-bar-error")).toHaveCount(0);
});
