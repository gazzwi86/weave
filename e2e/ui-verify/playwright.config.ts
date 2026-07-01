import { defineConfig, devices } from '@playwright/test';

// Self-test bench for the UI-verification gate. By default it serves the committed fixtures and
// runs the functional click-through + visual baseline against them, proving the gate works. Point
// UIV_TARGET at a real app URL to run the same spec shape against a built screen.
//
// Visual baselines are committed under fixtures/__screenshots__/. They are PLATFORM-SENSITIVE:
// macOS-generated baselines will not match Linux/CI headless Chrome. ALWAYS (re)generate them via
// the Docker-pinned image — see update-baselines.sh — so dev and CI agree. maxDiffPixelRatio is
// tight (0.01) per docs/standards/testing-ts.md; do not loosen it to silence platform drift —
// pin the baseline-generation platform instead.

const TARGET = process.env.UIV_TARGET || 'http://127.0.0.1:4321/good.html';
const usingFixtureServer = !process.env.UIV_TARGET;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: TARGET,
    trace: 'retain-on-failure', // trace export = supporting evidence for the human run-book
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Only stand up the static fixture server when no real target is supplied.
  webServer: usingFixtureServer
    ? {
        command: 'python3 -m http.server 4321 --directory fixtures',
        url: 'http://127.0.0.1:4321/good.html',
        reuseExistingServer: true,
        timeout: 15_000,
      }
    : undefined,
});
