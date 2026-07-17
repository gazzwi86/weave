import { defineConfig, devices } from "@playwright/test";

// TASK: docs/design/remediation-2-api-gaps.md T1 -- visual-regression baselines for the
// shell states that are the only signed-off app surface today (see tests/visual/README.md).
//
// DEVIATION from the brief: the brief said "just start `npm run dev`" on the assumption the
// shell renders unauthenticated. It doesn't -- `proxy.ts` (renamed middleware.ts) redirects
// every non-public path to /auth/login unless the request carries a valid next-auth session
// cookie. The mock OIDC provider (`weave-mock-oidc`, port 9001) is standalone -- no backend
// dependency -- so it's added to webServer here purely to authenticate once
// (tests/visual/global-setup.ts). The real backend (uvicorn:8000) is deliberately NOT started:
// the brief wants the backend-down shell state, and every shell surface degrades to a static
// error/empty state without it (see README "Backend-down determinism").
const AUTH_STATE_PATH = "tests/visual/.auth/state.json";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "shell.spec.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/visual/global-setup.ts",
  // Tight ratio per the brief -- deterministic shell states have no excuse for drift once
  // animations/fonts are pinned (see the launchOptions args below).
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" } },
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    // `reducedMotion` is nested under `contextOptions` in this installed Playwright
    // version's types (`PlaywrightTestOptions.contextOptions: BrowserContextOptions`) --
    // it is not a top-level `use` field here despite older docs/examples showing it flat.
    contextOptions: { reducedMotion: "reduce" },
    storageState: AUTH_STATE_PATH,
    trace: "retain-on-failure",
    // Deterministic font rendering across dev machines and CI's Linux headless Chrome --
    // matches the rationale in e2e/ui-verify/playwright.config.ts (don't loosen the ratio,
    // pin the renderer instead).
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
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
    },
    {
      command: "uv run weave-mock-oidc",
      cwd: "../backend",
      url: "http://localhost:9001/.well-known/openid-configuration",
      reuseExistingServer: true,
    },
  ],
});
