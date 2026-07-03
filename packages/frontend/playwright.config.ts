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
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: "html",
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
      reuseExistingServer: !process.env.CI,
      env: FRONTEND_ENV,
    },
    {
      command: "uv run uvicorn weave_backend:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "uv run weave-mock-oidc",
      cwd: "../backend",
      url: "http://localhost:9001/.well-known/openid-configuration",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
