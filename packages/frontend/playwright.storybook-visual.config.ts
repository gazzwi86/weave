import { defineConfig, devices } from "@playwright/test";

// TASK: docs/design/remediation-2-api-gaps.md T1 -- per-story visual baselines.
//
// FALLBACK (not @storybook/test-runner): that package pulls in its own jest-worker/
// playwright-core pin, duplicating the @playwright/test already in this repo, for what
// index.json + iframe.html already give us directly (see README "Why not
// @storybook/test-runner"). tests/visual/storybook.spec.ts reads the statically-built
// storybook-static/index.json *synchronously* at module-eval time (Playwright test files
// must register every test() call synchronously -- no top-level await, this repo's
// package.json has no "type": "module") -- so `npm run build-storybook` MUST run before this
// config (see package.json's test:storybook-visual script), not inside it.
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "storybook.spec.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" } },
  use: {
    baseURL: "http://localhost:6006",
    viewport: { width: 1024, height: 768 },
    // `reducedMotion` is nested under `contextOptions` in this installed Playwright
    // version's types (`PlaywrightTestOptions.contextOptions: BrowserContextOptions`) --
    // matches playwright.visual.config.ts.
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    // Same renderer pinning as playwright.visual.config.ts -- deterministic fonts/AA
    // across dev machines and CI's Linux headless Chrome.
    launchOptions: {
      args: [
        "--font-render-hinting=none",
        "--disable-font-subpixel-positioning",
        "--disable-lcd-text",
        "--disable-skia-runtime-opts",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Stdlib static server -- no new devDependency (serve/http-server) for what a
    // pre-built storybook-static/ directory needs.
    command: "python3 -m http.server 6006 --directory storybook-static",
    url: "http://localhost:6006/index.json",
    reuseExistingServer: true,
  },
});
