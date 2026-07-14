import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-TASK-015 AC-015-02/05 / testing-strategy.md §4 `tour.spec`: start a CE
// tour, keyboard through steps, skip, resume via help launcher, complete --
// axe zero-violations per step. Composes the per-story tour specs already on
// this branch (explorer-trust-mechanics-tour.spec.ts, ce-rules-policies-tour
// .spec.ts, explorer-completeness-tour.spec.ts) into one cross-story resume
// journey rather than re-modelling any tour step.
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close, same convention as the tour specs it composes.
test.fixme(
  "CE tour: keyboard through steps, skip, resume from help launcher, complete -- zero axe violations per step (AC-015-02/05)",
  async ({ page }) => {
    await page.goto("/ce?tour=rules-policies");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/ce/);

    await expect(page.getByText("1 of 2", { exact: false })).toBeVisible();
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter"); // advance via keyboard, not mouse
    await expect(page.getByText("2 of 2", { exact: false })).toBeVisible();

    // Skip mid-tour -- backend-state assertion: tour_progress persists the
    // skip, not a silent client-only dismissal.
    await page.getByRole("button", { name: /skip/i }).click();
    const afterSkip = await page.request.get("/api/onboarding/state");
    const skipBody = await afterSkip.json();
    expect(skipBody.tour_progress["tour.ce.rules-policies"].status).toBe("skipped");

    // Resume via the help launcher, not the original deep link.
    await page.getByRole("button", { name: "Help" }).click();
    await page.getByRole("link", { name: /resume.*rules.*policies/i }).click();
    await expect(page.getByText("2 of 2", { exact: false })).toBeVisible();
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: /done|finish|complete/i }).click();
    const afterComplete = await page.request.get("/api/onboarding/state");
    const completeBody = await afterComplete.json();
    expect(completeBody.tour_progress["tour.ce.rules-policies"].status).toBe("completed");
  },
);
