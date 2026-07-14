import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-TASK-015 AC-015-01 / testing-strategy.md §4 `first-sign-in.spec`:
// brand-new user signs in -> sandbox workspace forks, CE + Explorer render
// seed content, Build/Automate stay flagged off. Needs real Postgres behind
// the backend Playwright webServer boots -- this sandbox has none (same gap
// as every other onboarding E2E spec on this branch; see TASK-004/008 note).
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close, same convention as the other onboarding E2E specs.
//
// Note: workspace-switcher.spec.ts's AC-8/R7 ruling retired the header
// workspace switcher entirely -- the brief's "switcher shows Hammerbarn
// Demo" wording predates that ruling. This spec follows the ruling's own
// precedent (assert the sandbox pointer server-side, never via a
// member-visible switcher control) rather than resurrecting a retired UI.
test.fixme(
  "new user sign-in forks a sandbox workspace, CE/Explorer render seed content, Build/Automate flagged off (AC-015-01)",
  async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Backend-state assertion (Law B): the fork already happened server-side
    // by first dashboard load -- confirm via the onboarding state API, not
    // a UI label, per the retirement ruling above.
    const state = await page.request.get("/api/onboarding/state");
    const body = await state.json();
    expect(body.sandbox_workspace_id).toBeTruthy();
    expect(body.sandbox_label).toMatch(/demo.*fictional data/i);

    await page.goto("/ce");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Practice mode", { exact: false })).toBeVisible();

    await page.goto("/explorer");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Build/Automate flagged off for a brand-new user (M1 slice).
    await expect(page.getByRole("link", { name: /^Build$/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Automate$/ })).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  },
);
