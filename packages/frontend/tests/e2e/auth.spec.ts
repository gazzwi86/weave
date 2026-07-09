import { expect, test } from "@playwright/test";

// AC-2: unauthenticated visit to a protected page redirects to the OIDC
// hosted UI (mocked here), then returns to the originally-requested path
// after sign-in -- and the dashboard proves the session is backed by a
// real, backend-verified principal (Law B), not just a rendered UI.
test("redirects to sign-in and returns to the original path after login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\/login\?return_to=%2Fdashboard/);

  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("principal-iri")).toHaveText(
    "urn:weave:principal:user:admin"
  );
});

// Edge case (QA): middleware.ts builds `return_to` from `req.nextUrl.pathname`
// alone (no search params), so a protected path requested with a query
// string collapses to the bare path. Locking in the *current* behaviour so
// a future change to middleware.ts is a deliberate, reviewed decision --
// not a silent regression either way.
test("return_to from a query-string path currently drops the query string", async ({ page }) => {
  await page.goto("/dashboard?tab=graph");

  await expect(page).toHaveURL(/\/auth\/login\?return_to=%2Fdashboard$/);
});

// Lighthouse SEO's robots-txt audit needs the file served as plain text to an
// unauthenticated crawler -- middleware.ts's PUBLIC_PATHS guard was
// redirecting it to /auth/login (200 HTML, not a valid robots.txt).
test("robots.txt is served publicly, not redirected to sign-in", async ({ page }) => {
  const response = await page.goto("/robots.txt");

  expect(response?.status()).toBe(200);
  expect(page.url()).toMatch(/\/robots\.txt$/);
  expect(response?.headers()["content-type"]).toContain("text/plain");
});
