import { expect, test } from "@playwright/test";

import { gotoCeShell } from "./support";

// docs/design/remediation-2-api-gaps.md T1: baselines for the shell states --
// the only signed-off app surface today. Every interaction below is a real
// user path (page.click()/keyboard on a visible element) -- never
// page.evaluate() to invoke an app function directly, per the brief's rule
// (a past bug was masked that way).
//
// No mask needed today: with the backend deliberately not started (see
// playwright.visual.config.ts), every dynamic surface
// (notifications, avatar) settles to a static error/empty state rather than
// real timestamps or seeded content, so there is nothing to mask today. If a
// future baseline run adds the real backend, re-introduce `mask:` for the
// notification rows' relative-time text before rebaselining.

test.describe("shell states", () => {
  test("/ce default", async ({ page }) => {
    await gotoCeShell(page);
    await expect(page).toHaveScreenshot("ce-default.png");
  });

  test("sidebar collapsed", async ({ page }) => {
    await gotoCeShell(page);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page).toHaveScreenshot("ce-sidebar-collapsed.png");
  });

  test("notifications flyout open", async ({ page }) => {
    await gotoCeShell(page);
    await page.getByRole("button", { name: "Notifications" }).click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    await expect(panel).toBeVisible();
    // Backend is down -- the panel settles on its error state, never a
    // spinner (use-notifications.ts's fetch rejects immediately).
    await expect(panel.getByText("Couldn't load notifications.")).toBeVisible();
    await expect(page).toHaveScreenshot("ce-notifications-open.png");
  });

  test("help flyout open", async ({ page }) => {
    await gotoCeShell(page);
    await page.getByRole("button", { name: "Help", exact: true }).click();
    // help-launcher.tsx sets an explicit aria-label="Help" on Dialog.Content
    // (same string as the trigger and the Dialog.Title copy) -- that
    // aria-label wins the accessible-name computation over Dialog.Title.
    const panel = page.getByRole("dialog", { name: "Help" });
    await expect(panel).toBeVisible();
    await expect(page).toHaveScreenshot("ce-help-open.png");
  });

  test("user menu open", async ({ page }) => {
    await gotoCeShell(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    // avatar-menu.tsx sets aria-label="Account menu" on Dialog.Content, but
    // Radix wires its own aria-labelledby to Dialog.Title (the user's
    // display name, e.g. "Signed in" for this mock session) -- per the ARIA
    // name-computation order aria-labelledby wins over aria-label, so the
    // dialog's accessible name is actually the display name, not "Account
    // menu" (confirmed via this test's own failure trace). Locating by the
    // "Sign out" link -- present only in this panel -- is stable regardless
    // of which name the signed-in session carries.
    const panel = page.getByRole("dialog").filter({ has: page.getByRole("link", { name: "Sign out" }) });
    await expect(panel).toBeVisible();
    await expect(page).toHaveScreenshot("ce-user-menu-open.png");
  });

  test("command palette open", async ({ page }) => {
    await gotoCeShell(page);
    // Real ⌘K keydown (AC-3, command-palette.tsx's useCommandPaletteHotkey)
    // -- never the CustomEvent dispatch shortcut the top-bar button uses,
    // so this exercises the actual keyboard path a user relies on.
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder("Search entities…")).toBeVisible();
    // Flake found in determinism run: the "Constitution Engine chat" panel
    // (app/ce/chat/chat-panel.tsx) behind the palette overlay settles its
    // retry/error state on a slightly different frame across runs even with
    // networkidle + animations disabled -- causing sub-1% pixel drift in
    // that region only (dialog itself never diffed). Masked rather than
    // chasing the exact timing, since this test targets the palette, not
    // the chat panel's backend-down behaviour.
    const chatPanel = page.getByRole("region", { name: "Constitution Engine chat" });
    await expect(page).toHaveScreenshot("ce-command-palette-open.png", { mask: [chatPanel] });
  });
});
