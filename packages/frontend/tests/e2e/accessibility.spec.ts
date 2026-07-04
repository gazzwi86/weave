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
