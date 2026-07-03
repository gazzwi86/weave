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
  await expect(page.getByTestId("principal-iri")).toHaveText("urn:weave:principal:dev-user-1");
});
