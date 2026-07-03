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
// caught. Marked `test.fail()`, not a plain assertion: this documents a
// known, real defect (QA failure report FAIL-3) rather than silently
// failing CI -- remove the `.fail()` annotation once the Engineer fixes the
// token and this test starts passing for real.
test.describe("dashboard accessibility (axe-core, real browser)", () => {
  test.fail(true, "FAIL-3: dashboard footer color-contrast violation, see QA report");

  test("dashboard has zero axe violations after login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
