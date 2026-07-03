import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
test.describe("dashboard accessibility (axe-core, real browser)", () => {
  test("dashboard has zero axe violations after login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    // Same wait auth.spec.ts/global-search.spec.ts use -- without it the
    // second click races the mock OIDC page's own load and misses (flaky).
    await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
