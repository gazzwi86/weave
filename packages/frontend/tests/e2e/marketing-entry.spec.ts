import { expect, test } from "@playwright/test";

// AC-6 / test_bare_login_redirects_to_auth_login -- F-D25 literal-URL insurance.
test("redirects a visitor from bare /login to /auth/login, preserving query string", async ({ page }) => {
  const response = await page.request.get("/login?return_to=%2Fdashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toBe("/auth/login?return_to=%2Fdashboard");

  await page.goto("/login?return_to=%2Fdashboard");
  await expect(page).toHaveURL(/\/auth\/login\?return_to=%2Fdashboard$/);
});

// AC-7 / test_marketing_ctas_navigate_to_auth_login -- regression-lock on
// cta-link.tsx's existing client-side navigation behaviour.
test("clicking Log in or Get started on the marketing index navigates to /auth/login without a full reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
  });

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(
    await page.evaluate(() => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker)
  ).toBe(true);
});
