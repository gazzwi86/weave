import type { Page } from "@playwright/test";

/** Same shape as tests/e2e/ce-authoring.spec.ts's `dismissOnboarding` --
 * duplicated (not imported) because this suite's config/webServer set is
 * intentionally smaller (no real backend). A first-visit welcome modal +
 * driver.js tour overlay the shell on every fresh session (real backend or
 * not -- see README), so every screenshot must click through it first or
 * the shot captures the overlay instead of the shell state under test. */
export async function dismissOnboarding(page: Page): Promise<void> {
  const welcome = page.getByRole("dialog").filter({ hasText: /welcome/i });
  try {
    await welcome.waitFor({ state: "visible", timeout: 3000 });
    await welcome.getByRole("button").last().click();
  } catch {
    // no welcome modal for this area/session.
  }
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  try {
    await skipTour.waitFor({ state: "visible", timeout: 2000 });
    await skipTour.click();
  } catch {
    // no tour started (non-tour-CTA area, or already seen).
  }
}

/** Lands on /ce authenticated (storageState from global-setup.ts already
 * carries the session cookie), waits out cold dev-server compile, and
 * clears the onboarding overlay -- the common prelude every shell-state
 * spec needs before it can interact with the real shell chrome. */
export async function gotoCeShell(page: Page): Promise<void> {
  await page.goto("/ce");
  await page.waitForLoadState("networkidle");
  await dismissOnboarding(page);
}
