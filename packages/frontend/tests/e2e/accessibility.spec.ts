import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// QA edge case (PLAT-TASK-005 checklist item 6/Category 15): a real-browser
// axe-core pass was a gap -- `@axe-core/playwright` is an installed
// dependency but no spec exercised it; the existing a11y coverage is
// jsdom-based `vitest-axe` (shell.a11y.test.tsx), which can't compute real
// paint/contrast. That gap is exactly why the dashboard footer's WCAG 1.4.3
// color-contrast violation (`--color-text-subtle` on `--text-caption`,
// contrast ratio ~3.2:1 against the dark `--color-surface`, below the 4.5:1
// AA minimum for small text -- also a direct violation of
// typography.md's own rule that `--text-caption` must use
// `--color-text-default`/`--color-text-muted`, never `subtle`) was never
// caught. FAIL-3 fixed: footer swapped to `--color-text-muted`; this now
// runs as a normal passing assertion, not `test.fail()`.
//
// Each test uses its own fixture `page` (not a shared browser.newPage()) --
// @axe-core/playwright requires the fixture-provided page/context to inject
// its script; a manually-created page throws "Please use browser.newContext()".
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  // Same wait auth.spec.ts/global-search.spec.ts use -- without it the
  // second click races the mock OIDC page's own load and misses (flaky).
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("dashboard accessibility (axe-core, real browser)", () => {
  test("dashboard has zero axe violations after login", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // TASK-007: new UI screen (notification centre) gets the same real-browser
  // axe pass, opened with an item present so the panel isn't checked empty.
  test("notification centre has zero axe violations when open", async ({ page }) => {
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: [
            {
              id: "n-1",
              event_type: "job.completed",
              payload: {},
              delivered_channels: ["in_app"],
              read: false,
              created_at: "2026-07-04T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          per_page: 25,
        }),
      });
    });

    await loginAndGoToDashboard(page);

    // Waiting for the badge (same assertion notifications.spec.ts makes)
    // settles the mount-time unread fetch/re-render *before* the click --
    // otherwise the click occasionally lands mid-reconciliation, while the
    // trigger button's children are still changing shape as the badge
    // mounts, and React drops it (intermittent, same class of race
    // auth.spec.ts/global-search.spec.ts note for the mock OIDC page).
    const trigger = page.getByRole("button", { name: "Notifications" });
    await expect(trigger.getByText("1")).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// PLAT-TASK-008: the minimal billing usage dashboard, with the
// budget-cap-reached error banner visible (its own colour/contrast surface,
// worth checking on its own rather than only the empty state). Separate
// describe block from the dashboard one above so neither's callback grows
// past the max-lines-per-function budget.
test.describe("billing accessibility (axe-core, real browser)", () => {
  test("billing usage dashboard has zero axe violations with the cap-reached banner shown", async ({
    page,
  }) => {
    await page.route("**/api/billing/usage**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          period: "2026-07",
          total_tokens: 100,
          total_runs: 1,
          total_cost_usd: 1.0,
          by_workspace: [
            { workspace_id: "ws-1", total_tokens: 100, total_runs: 1, total_cost_usd: 1.0 },
          ],
          cap_utilisation_pct: 100.0,
        }),
      });
    });
    await page.route("**/api/billing/simulate-ai-call**", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { error: "budget_cap_reached", effective_cap_usd: 1.0, consumed_usd: 1.0 },
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/billing");
    await page.getByLabel("Workspace ID").fill("ws-1");
    await page.getByRole("button", { name: "Simulate AI call" }).click();
    // Next.js always renders a hidden route-announcer with role="alert" too,
    // so scope to the one with our text (getByRole("alert") alone is ambiguous).
    await expect(page.getByRole("alert").filter({ hasText: "Budget cap reached" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// PLAT-TASK-009: the compliance sub-view, with a populated summary shown
// (chain status badge + category/actor lists), not the empty state.
test.describe("compliance accessibility (axe-core, real browser)", () => {
  test("compliance view has zero axe violations", async ({ page }) => {
    await page.route("**/api/audit/compliance**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chain_status: "valid",
          entries_checked: 42,
          first_broken_seq: null,
          by_event_category: { workspace: 12, security: 3 },
          top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
          period: "2026-07",
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/compliance");
    await expect(page.getByTestId("chain-status")).toContainText("valid");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// GE-TASK-002 QA FIX 3: no real-browser axe pass existed for /explorer's
// force canvas -- Cytoscape draws to <canvas>, so this also checks the
// canvas/minimap wrapper elements carry accessible names rather than being
// silent to a screen reader, not just colour contrast.
test.describe("explorer accessibility (axe-core, real browser)", () => {
  test("explorer force canvas has zero axe violations", async ({ page }) => {
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: "https://weave.example/process/onboarding",
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Process",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await expect(page.getByTestId("explorer-canvas")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
