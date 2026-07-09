import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- kept local
// (not extracted to a shared helper) since it's the only other spec that
// needs it and duplicating four lines is cheaper than a shared fixture file.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  // Same wait auth.spec.ts/accessibility.spec.ts use -- without it this
  // click races the mock OIDC page's own load and lands on the callback
  // URL before it resolves (FAIL-5: ~1 run in 3 flake).
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// One shared login for the whole file, not one per test: middleware.ts's
// auth rate-limit (5 requests/60s, keyed by "unknown" for every local
// Playwright run -- see lib/rate-limit.ts) is shared process-wide across
// every spec file the dev server serves, so three concurrent logins here
// on top of auth.spec.ts's own two trips it. Serial + a single login
// keeps this file's budget to one, and proves AC-2/3/4/7 don't need more.
test.describe.configure({ mode: "serial" });

test.describe("global search + help launcher", () => {
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    page = await browser.newPage();
    await loginAndGoToDashboard(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("Cmd+K opens the search palette, focuses input, Escape dismisses (AC-2)", async () => {
    await page.keyboard.press("ControlOrMeta+k");
    // Scoped to the dialog: getByRole("combobox") alone also matches the
    // header's workspace <select> (Chromium maps single <select> to
    // role=combobox too), so an unscoped locator can flip between
    // 1 and 2 matches depending on whether that select's async fetch
    // has resolved yet -- an order-dependent flake, not a focus bug.
    const input = page.getByRole("dialog", { name: "Global search" }).getByRole("combobox");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  // AC-4's "no full page reload" is proven at the unit level
  // (command-palette.test.tsx asserts next/navigation's router.push is
  // called, not an <a href> / window.location assignment). This E2E only
  // asserts the resulting URL: /ce/resource doesn't exist yet (M1), and
  // Next's App Router falls back to a hard navigation when router.push
  // targets a route with no matching page -- that fallback is Next's own
  // behaviour for an unmatched route, not a signal about which navigation
  // API our code called.
  test("selecting a search result navigates to /ce/resource?iri=... (AC-3/4)", async () => {
    await page.route("**/api/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ iri: "urn:weave:entity:acme", label: "Acme Corp", kind: "Organization" }],
          total: 1,
        }),
      });
    });

    await page.keyboard.press("ControlOrMeta+k");
    await page
      .getByRole("dialog", { name: "Global search" })
      .getByRole("combobox")
      .fill("acme");
    await page.getByText("Acme Corp").click();

    await expect(page).toHaveURL(/\/ce\/resource\?iri=urn%3Aweave%3Aentity%3Aacme/);
  });

  test("help launcher opens a contextual help panel without navigating away (AC-7)", async () => {
    // Previous test navigated to /ce/resource (a 404 in M1); the session
    // cookie is still valid so this is a same-origin nav, not another login.
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Help" }).click();
    await expect(page.getByRole("dialog", { name: "Help" })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Close help" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
