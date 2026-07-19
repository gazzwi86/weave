import { expect, test, type Page } from "@playwright/test";

// PoC IA skeleton (docs/design/poc-ia-proposal.md): a human can log in, land
// on Home, reach five of the six top areas, hit the green CE + Audit
// screens, see the shipped Build request form and the disabled Events rail
// item (post-MVP, T7 -- no clickable entry), and get the marketing index
// logged out. Uses the two seeded demo logins
// (seed_demo.py): admin@weave.local (admin) / client@weave.local (author).

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("marketing index renders logged-out with login CTAs and no app chrome", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The operating system for the AI-native company" })
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  const cta = page.getByRole("link", { name: "Get started" }).first();
  await expect(cta).toHaveAttribute("href", "/auth/login");
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
});

test("admin can navigate all six IA areas end to end", async ({ page }) => {
  await loginAs(page, "admin@weave.local");

  // Home: five clickable top tabs + tenant chip + sign-out. Events is
  // disabled (post-MVP, T7) -- a non-link "coming soon" button, not a tab.
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const label of ["Home", "Constitution", "Build", "Audit trail", "Settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: "Events — coming soon" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await expect(page.getByText("acme-corp").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign out" })).toBeVisible();

  // Constitution: green Instances screen + rail with dimmed M2 placeholders.
  await nav.getByRole("link", { name: "Constitution" }).click();
  await expect(page).toHaveURL(/\/ce$/);
  const rail = page.getByRole("navigation", { name: "Secondary" });
  await expect(rail.getByRole("link", { name: /Query/ })).toBeVisible();
  await expect(rail.getByText("Glossary")).toBeVisible();
  await expect(rail.getByRole("link", { name: /Glossary/ })).toHaveCount(0);

  // Ontology / Types: real kinds from the authoritative endpoint.
  await rail.getByRole("link", { name: /Ontology \/ Types/ }).click();
  await expect(page.getByTestId("kind-list")).toBeVisible();
  await expect(page.getByTestId("kind-list").getByText("Process", { exact: true })).toBeVisible();

  // Build: shipped M1 "Request application" form.
  await nav.getByRole("link", { name: "Build" }).click();
  await expect(page.getByRole("heading", { name: "Request application" })).toBeVisible();

  // Audit trail: M1 dashboard stub, rail reaches the green compliance screen.
  await nav.getByRole("link", { name: "Audit trail" }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await rail.getByRole("link", { name: /Compliance/ }).click();
  await expect(page.getByTestId("chain-status")).toBeVisible();

  // Settings: index redirects to models; admin sees Workspaces provisioning.
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings\/models$/);
  await expect(rail.getByRole("link", { name: /Billing & budgets/ })).toBeVisible();
  await rail.getByRole("link", { name: /Workspaces/ }).click();
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
  await expect(page.getByTestId("workspaces-denied")).toHaveCount(0);
});

test("author role does not see admin-only workspace provisioning", async ({ page }) => {
  await loginAs(page, "client@weave.local");

  await page.goto("/settings/models");
  const rail = page.getByRole("navigation", { name: "Secondary" });
  await expect(rail.getByRole("link", { name: /Models & AI/ })).toBeVisible();
  await expect(rail.getByText("Workspaces")).toHaveCount(0);

  // Direct URL visit stays honest server-side too.
  await page.goto("/settings/workspaces");
  await expect(page.getByTestId("workspaces-denied")).toBeVisible();
});
