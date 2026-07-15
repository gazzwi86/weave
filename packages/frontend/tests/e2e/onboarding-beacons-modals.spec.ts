import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-TASK-008: beacon + welcome-modal renderer host, mounted app-wide via
// OnboardingHintsHost (components/onboarding/onboarding-hints-host.tsx).
// Dismissal persistence is via the M1 API (PUT/DELETE
// /api/onboarding/dismissals/{kind}/{ref_id}), which needs a real Postgres
// behind the backend the Playwright webServer boots -- this sandbox has none
// (see the docker-integration marker note in .claude/memory).
// ponytail: sandbox has no Postgres for Playwright webServer -- runs at real-env epic-close
test.fixme("beacon on the CE Versions panel: click -> tooltip -> dismiss persists, zero axe violations (AC-008-01/02/07)", async ({
  page,
}) => {
  await page.goto("/ce/versions");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();

  const beacon = page.getByRole("button", { name: /hint available/i });
  await expect(beacon).toBeVisible();
  await beacon.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: /got it/i }).click();
  await expect(beacon).not.toBeVisible();

  // survives a reload -- the dismissal round-trip actually persisted server-side.
  await page.reload();
  await expect(beacon).not.toBeVisible();
});

// ponytail: sandbox has no Postgres for Playwright webServer -- runs at real-env epic-close
test.fixme("welcome modal fires once per area across sign-out/sign-in (AC-008-04)", async ({ page }) => {
  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("dialog", { name: /welcome to constitution/i })).toBeVisible();
  await page.getByRole("button", { name: /take a tour/i }).click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/ce");

  await expect(page.getByRole("dialog", { name: /welcome to constitution/i })).not.toBeVisible();
});
