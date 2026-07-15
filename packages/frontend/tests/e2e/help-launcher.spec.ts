import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-TASK-015 AC-015-05 / testing-strategy.md §4 `help-launcher.spec`:
// dismissal/state round-trip for the launcher panel itself (ONB-TASK-013),
// composed with the resume-a-tour path already covered by tour.spec.ts.
// Reuses the "Help" button aria-label the launcher ships with
// (components/shell/help-launcher.tsx) rather than re-modelling it.
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close, same convention as the other onboarding E2E specs.
test.fixme(
  "help launcher: open, dismiss survives reload, zero axe violations (AC-015-05, AC-013-*)",
  async ({ page }) => {
    await page.goto("/ce");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    const launcher = page.getByRole("button", { name: "Help" });
    await expect(launcher).toBeVisible();
    await launcher.click();

    await expect(page.getByLabel("Help for this page")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: "Close help" }).click();
    await expect(page.getByLabel("Help for this page")).toHaveCount(0);

    // Backend-state assertion (Law B): panel-open state, if persisted,
    // round-trips across reload rather than resetting client-side only.
    await page.reload();
    await expect(page.getByLabel("Help for this page")).toHaveCount(0);
    await expect(launcher).toBeVisible();
  },
);
