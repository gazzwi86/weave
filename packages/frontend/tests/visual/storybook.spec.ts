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

test.describe("storybook: per-story baselines", () => {
  for (const id of storyIds) {
    test(id, async ({ page }) => {
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
