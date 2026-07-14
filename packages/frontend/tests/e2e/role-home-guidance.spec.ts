import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-V1-TASK-003: role-home welcome modal + tour.plat.role-home walkthrough,
// and the competency-question completeness-tile beacon. Both dismissal
// persistence and tour-progress persistence need the M1/M2 API against a
// real Postgres behind the backend the Playwright webServer boots -- this
// sandbox has none (see the docker-integration marker note in .claude/memory).
// ponytail: sandbox has no Postgres for Playwright webServer -- runs at real-env epic-close
test.fixme(
  "first visit to role-home: welcome modal -> tour.plat.role-home walks all 5 anchors, zero axe violations, explicit focus trap (AC-003-01/02/06)",
  async ({ page }) => {
    await page.goto("/role-home");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    const modal = page.getByRole("dialog", { name: /what can weave do for you/i });
    await expect(modal).toBeVisible();

    // Explicit focus-trap assertion (team-lead: don't trust Radix's default) --
    // Tab cycles within the dialog, Esc closes, focus returns to a stable point.
    const focusablesInModal = modal.locator("button, a[href]");
    const count = await focusablesInModal.count();
    for (let i = 0; i < count + 1; i += 1) {
      await page.keyboard.press("Tab");
      await expect(modal.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // Re-open via the modal's tour CTA and step through all 5 anchors in order.
    await page.reload();
    await page.getByRole("button", { name: /take a tour/i }).click();
    const anchorOrder = [
      "plat.role-home.nav-entry",
      "plat.role-home.capabilities",
      "plat.role-home.completeness-map",
      "plat.role-home.next-action",
      "plat.role-home.summary-tiles",
    ];
    for (const anchorId of anchorOrder) {
      await expect(page.locator(`[data-tour-id="${anchorId}"]`)).toBeVisible();
      await page.getByRole("button", { name: /next/i }).click();
    }

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  },
);

// ponytail: sandbox has no Postgres for Playwright webServer -- runs at real-env
// epic-close. Cross-task gap beyond the DB: /help/training has no per-article
// "mark done" CTA and the item's deepLink (/training/declare-competency-questions)
// resolves to no route, so this self-mark path isn't exercisable via any UI yet
// even with a live server. Hide-on-complete is covered at the unit/integration
// level (derive-checklist.test.ts, onboarding-hints-host.test.tsx) against the
// same isChecklistItemOpen this beacon uses. See the TASK-003 receipt.
test.fixme(
  "role-home completeness-tile beacon: visible while add-competency-questions is open, hidden once self-marked (AC-003-03/04)",
  async ({ page }) => {
    await page.goto("/role-home");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    const beacon = page.getByRole("button", { name: /hint available/i });
    await expect(beacon).toBeVisible();

    // Self-mark via the checklist deep link (once a mark-done CTA exists there).
    await beacon.click();
    await page.getByRole("link", { name: /learn more/i }).click();
    await page.getByRole("button", { name: /mark done/i }).click();

    await page.goto("/role-home");
    await expect(page.getByRole("button", { name: /hint available/i })).not.toBeVisible();
  },
);
