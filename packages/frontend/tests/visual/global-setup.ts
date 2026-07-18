import { chromium, expect, type FullConfig } from "@playwright/test";

import { dismissOnboarding } from "./support";

const AUTH_STATE_PATH = "tests/visual/.auth/state.json";

/** Logs in once via the mock OIDC provider (same click-through as
 * tests/e2e/ce-authoring.spec.ts) and caches the resulting session cookie
 * as Playwright storageState -- every spec then starts already-authenticated
 * (Playwright's documented "authenticate once" recipe) instead of each test
 * re-running the OIDC round trip. This is the real app's own cookie, signed
 * by next-auth's own encode path -- not a hand-crafted JWT -- so it can
 * never drift out of sync with an auth.ts change. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3500";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce$/);
  await dismissOnboarding(page);

  await page.context().storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
