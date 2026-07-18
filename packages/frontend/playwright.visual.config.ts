import { defineConfig, devices } from "@playwright/test";

// TASK: docs/design/remediation-2-api-gaps.md T1 -- visual-regression baselines for the
// shell states that are the only signed-off app surface today (see tests/visual/README.md).
//
// DEVIATION from the brief: the brief said "just start `npm run dev`" on the assumption the
// shell renders unauthenticated. It doesn't -- `proxy.ts` (renamed middleware.ts) redirects
// every non-public path to /auth/login unless the request carries a valid next-auth session
// cookie. The mock OIDC provider (`weave-mock-oidc`, port 9001) is standalone -- no backend
// dependency -- so it's added to webServer here purely to authenticate once
// (tests/visual/global-setup.ts). The real backend is deliberately NOT started: the brief
// wants the backend-down shell state, and every shell surface degrades to a static
// error/empty state without it (see README "Backend-down determinism").
//
// PORT + BACKEND_API_URL pinning (found during rebaseline, see README "Determinism hazards"):
// `next dev`'s default port 3000 and the backend's default port 8000 are shared by every
// worktree on this machine. `reuseExistingServer: true` trusts whatever answers on the URL --
// with no port isolation it silently screenshots a SIBLING worktree's dev server (wrong app
// build) and/or that sibling's real backend (live workspace data, e.g. the practice-mode
// banner) instead of this suite's own backend-down build. Both broke a determinism run.
// Fix: bind this suite's own dev server to a port unlikely to collide, and pin the app's
// upstream to a port nothing binds -- guaranteeing "backend down" is true regardless of what
// else is running on the shared machine.
const AUTH_STATE_PATH = "tests/visual/.auth/state.json";
const DEV_PORT = 3500;
// Port 1 is privileged (unbindable by any dev server without root) -- a guaranteed-refused
// loopback target, not just an unlikely-to-collide one.
const UNREACHABLE_BACKEND = "http://127.0.0.1:1";

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
    baseURL: process.env.TEST_BASE_URL ?? `http://localhost:${DEV_PORT}`,
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
      command: `npm run dev -- -p ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: true,
      env: { BACKEND_API_URL: process.env.BACKEND_API_URL ?? UNREACHABLE_BACKEND },
    },
    {
      command: "uv run weave-mock-oidc",
      cwd: "../backend",
      url: "http://localhost:9001/.well-known/openid-configuration",
      reuseExistingServer: true,
    },
  ],
});
