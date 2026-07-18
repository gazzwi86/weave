import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

// docs/design/remediation-2-api-gaps.md T1 -- one baseline screenshot per Storybook story.
// `npm run build-storybook` (see package.json's test:storybook-visual script) must run
// before this spec is loaded: Playwright registers every test() synchronously while parsing
// the file, so the story list has to already be on disk (sync fs.readFileSync), not fetched
// over the network at collection time.
interface StoryIndexEntry {
  id: string;
  type: string;
}

interface StoryIndex {
  entries: Record<string, StoryIndexEntry>;
}

const indexPath = path.join(__dirname, "../../storybook-static/index.json");
const index: StoryIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
const storyIds = Object.values(index.entries)
  .filter((entry) => entry.type === "story")
  .map((entry) => entry.id)
  .sort();

// T1b (docs/design/remediation-2-api-gaps.md) -- every `*Dark`-suffixed story (e.g.
// `DefaultDark`) sets `parameters: { theme: "dark" }`, but that parameter was never wired to
// anything: `.storybook/preview.tsx` had no decorator reading it, so app/globals.css's
// `@media (prefers-color-scheme: dark)` rule fell back to Playwright's real default
// (`colorScheme: 'light'`) for every story, dark or light. Every "Dark" baseline was a light
// screenshot -- duplicate coverage, zero real dark assertions.
//
// DEVIATION from the brief: the brief suggested a Storybook decorator/global (a `data-theme`
// attribute or a `globalTypes` theme toggle). Storybook's id is deterministically derived from
// the export name (`DefaultDark` -> `...--default-dark`), so this suite already knows which
// stories are dark without reading any Storybook parameter -- forcing `page.emulateMedia()`
// per test exercises the app's REAL `prefers-color-scheme` CSS path directly (the one real
// users hit), with zero new production surface area, instead of inventing a `data-theme`
// attribute system the app doesn't otherwise have (and `app/globals.css` is already over its
// 300-line budget -- duplicating the light/dark token blocks under a parallel attribute
// selector would make that worse). Trade-off: this does NOT make Storybook's own dev-mode UI
// (`npm run storybook`, browsing interactively) render Dark stories dark -- only this
// automated capture. That's fine for the task's stated acceptance check (a Playwright
// computed-style assertion), but call it out for anyone who goes looking for a decorator.
const darkStoryIds = new Set(storyIds.filter((id) => id.endsWith("-dark")));

test.describe("storybook: per-story baselines", () => {
  for (const id of storyIds) {
    test(id, async ({ page }) => {
      await page.emulateMedia({ colorScheme: darkStoryIds.has(id) ? "dark" : "light" });
      await page.goto(`/iframe.html?id=${id}&viewMode=story`);
      const root = page.locator("#storybook-root");
      // Sanity check that the story actually rendered (catches a real crash/import
      // error) without requiring a non-zero layout box -- see the fixed-position
      // note below for why box size can't be the check here.
      await expect(root.locator(":scope > *").first()).toBeAttached();
      await page.waitForLoadState("networkidle");
      // ponytail: fixed buffer for the handful of stories with a `play` function (typing
      // simulation etc) to settle -- upgrade to a real "story rendered" signal if this
      // proves flaky, rather than growing the buffer.
      await page.waitForTimeout(300);
      // CommandBar (and any other `position: fixed` root content, e.g. a Cmd-K-style
      // dialog) escapes #storybook-root's normal document flow, collapsing root to a
      // 0x0 box -- Playwright's `toBeVisible()`/element-screenshot both treat that as
      // hidden even though the dialog is genuinely rendered on screen. Falling back to
      // a full-page screenshot only when root's own box is empty; every other story's
      // root box already equals its content box, so this is a no-op for those.
      const box = await root.boundingBox();
      const target = box && box.width > 0 && box.height > 0 ? root : page;
      // RelativeTime ("3 hours ago") is the only clock-driven content in the story
      // catalogue (grep confirms) -- mask every <time> unconditionally so no story needs
      // special-casing if one adds a live timestamp later.
      await expect(target).toHaveScreenshot(`${id}.png`, { mask: [page.locator("time")] });
    });
  }
});

// T1b acceptance check -- a positive logic assertion, not just baseline pixels. Baselines alone
// don't catch a regression where `emulateMedia` above silently stops working (e.g. someone
// removes the call) and every "Dark" screenshot goes back to matching its Light sibling one
// -- `--update-snapshots` would happily re-bless that as the new baseline. This asserts the
// actual `prefers-color-scheme` CSS effect: a Dark story's resolved background colour must
// differ from its Light sibling's.
test.describe("storybook: dark mode actually renders dark", () => {
  test("Button default: dark token differs from light token", async ({ page }) => {
    // Read the `--color-bg` custom property directly rather than an element's computed
    // `backgroundColor` -- no element in the isolated story iframe actually paints
    // `var(--color-bg)` onto its background (that only happens via a `bg-background`
    // utility class in the real app layout), but `:root` sets the property itself
    // unconditionally, so it's the real signal of which `@media (prefers-color-scheme)`
    // branch of app/globals.css is active.
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/iframe.html?id=atoms-button--default&viewMode=story");
    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
    );

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/iframe.html?id=atoms-button--default-dark&viewMode=story");
    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
    );

    expect(lightBg).not.toBe("");
    expect(darkBg).not.toBe("");
    expect(darkBg).not.toBe(lightBg);
  });
});
