import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Registry (refit-mock.html #sub-bld-registry): PageHeader-driven title +
// "New project" header action, cards linking to the project dashboard.
// Cloned login helper from board.spec.ts/project-dashboard.spec.ts --
// authored against the real (unmocked) backend, same convention (requires
// the live dev stack with the demo tenant, acme-corp).

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
}

test.use({ colorScheme: "dark" });

// Law B: don't just assert the UI rendered -- create a project through the
// real header action + backend, then reload the Registry and prove the new
// card (name + Speccing phase pill) reflects that backend state change.
test("New project header action creates a project that shows up on the Registry grid", async ({
  page,
}) => {
  await loginAs(page, "admin@weave.local");

  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  const projectName = `E2E registry test ${Date.now()}`;

  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);

  await page.goto("/build");
  const card = page.getByRole("link", { name: new RegExp(projectName) });
  await expect(card).toBeVisible();
  await expect(card.getByText("speccing")).toBeVisible();

  await page.screenshot({ path: "test-results/registry--dark.png", fullPage: true });
});
