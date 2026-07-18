// ponytail: throwaway isolated-port config for one-off manual verification of
// the audit-compliance/audit-logs e2e specs in this worktree (port-collision
// memory note). Never committed, never referenced by CI.
import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const FRONTEND_ROOT = __dirname;
const BACKEND_ROOT = `${__dirname}/../backend`;

const AUTH_SECRET = randomBytes(32).toString("hex");
const FRONTEND_ENV = {
  AUTH_SECRET,
  OIDC_ISSUER_URL: "http://localhost:9601",
  OIDC_CLIENT_ID: "weave-dev",
  OIDC_CLIENT_SECRET: "dev-secret",
  BACKEND_API_URL: "http://localhost:8600",
  AUTH_RATE_LIMIT_MAX: "600",
  PORT: "3600",
};

export default defineConfig({
  testDir: `${FRONTEND_ROOT}/tests/e2e`,
  testMatch: ["audit-compliance.spec.ts", "audit-logs.spec.ts"],
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 20000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: "http://localhost:3600",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- -p 3600",
      cwd: FRONTEND_ROOT,
      url: "http://localhost:3600",
      reuseExistingServer: false,
      env: FRONTEND_ENV,
    },
    {
      command: "uv run uvicorn weave_backend:app --port 8600",
      cwd: BACKEND_ROOT,
      url: "http://localhost:8600/api/health",
      reuseExistingServer: false,
      env: {
        WEAVE_MODEL_PROVIDER: "ollama",
        OLLAMA_MODEL: "batiai/qwen3.6-27b:iq3",
        OIDC_ISSUER_URL: "http://localhost:9601",
      },
    },
    {
      command: "uv run uvicorn weave_backend.mock_oidc.app:app --port 9601",
      cwd: BACKEND_ROOT,
      url: "http://localhost:9601/.well-known/openid-configuration",
      reuseExistingServer: false,
      env: { MOCK_OIDC_ISSUER_URL: "http://localhost:9601" },
    },
  ],
});
