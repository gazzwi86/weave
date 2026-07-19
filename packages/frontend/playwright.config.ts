import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

// AUTH_SECRET only needs to exist for this test run's lifetime -- generated
// fresh each run rather than a hardcoded placeholder value. The OIDC client
// secret is the mock provider's well-known dev-only value (see auth.ts).
const AUTH_SECRET = randomBytes(32).toString("hex");
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET ?? "dev-secret";
const FRONTEND_ENV = {
  AUTH_SECRET,
  OIDC_ISSUER_URL: "http://localhost:9001",
  OIDC_CLIENT_ID: "weave-dev",
  OIDC_CLIENT_SECRET,
  BACKEND_API_URL: "http://localhost:8000",
  // Fresh login per e2e test (~5 /api/auth requests each) shares one
  // in-memory rate-limit budget (lib/rate-limit.ts) -- raise the ceiling
  // for this harness-launched server only, prod default is unaffected.
  // 55 tests x ~5 requests ~= 275 within a ~90s run outgrew 100/60s
  // (observed flake); 600 keeps the same ~2x headroom for suite growth.
  AUTH_RATE_LIMIT_MAX: "600",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Every auth spec shares one in-memory rate-limit budget (lib/rate-limit.ts,
  // keyed by x-forwarded-for -- absent locally, so every request is "unknown").
  // Parallel workers race real OIDC logins against that shared budget and hang
  // mid-callback. One worker always, not just in CI.
  workers: 1,
  // PLAYWRIGHT_REUSE=1 lets a spec suite attach to servers the CI job already
  // started (so the job can capture the backend's own log for the API-log
  // sweep -- see .github/workflows/ci.yml `e2e-behavioural`). Without it, the
  // default holds: reuse a locally-running stack, but in CI start a fresh one.
  // Retries stay CI-gated (unaffected), so reuse doesn't weaken flake headroom.
  // TASK-029 AC-3: the GE-CANVAS-1 conformance report is the Build-M2
  // unblock evidence -- a tiny extra reporter alongside the existing html
  // one, not a replacement.
  reporter: [["html"], ["./tests/reporters/ge-canvas-conformance-reporter.ts"]],
  // Matches e2e/ui-verify's tolerance (0.01) -- ledger item 2's visual baselines.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // AC-2 E2E drives the real stack: frontend, backend, and the mock OIDC
  // hosted UI all need to be up (Law F: local processes only, no cloud).
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE || !process.env.CI,
      env: FRONTEND_ENV,
    },
    {
      // ADR-018: dashboard-generate's happy-path E2E needs a real,
      // reachable classifier -- same host-native Ollama default as
      // `make dev` (ADR-011), not the bare-Anthropic-no-key default that
      // always 503s.
      command: "uv run uvicorn weave_backend:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE || !process.env.CI,
      env: {
        WEAVE_MODEL_PROVIDER: "ollama",
        OLLAMA_MODEL: "batiai/qwen3.6-27b:iq3",
      },
    },
    {
      command: "uv run weave-mock-oidc",
      cwd: "../backend",
      url: "http://localhost:9001/.well-known/openid-configuration",
      reuseExistingServer: !!process.env.PLAYWRIGHT_REUSE || !process.env.CI,
    },
  ],
});
