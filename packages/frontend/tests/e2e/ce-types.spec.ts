import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors glossary.spec.ts's login + section-rail navigation helper.
async function loginAndGoToTypes(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Constitution" }).click();
  await page
    .getByRole("navigation", { name: "Secondary" })
    .getByRole("link", { name: /^Ontology \/ Types/ })
    .click();
  await expect(page).toHaveURL(/\/ce\/types$/);
  // Next dev-mode compiles the route on first hit -- wait settle before
  // interacting, same flake ce-query.spec.ts/glossary.spec.ts document.
  await page.waitForLoadState("networkidle");
}

const TYPES_BODY = {
  kinds: [
    {
      iri: "https://weave.dev/ontology/bpmo#Process",
      label: "Process",
      description: "A repeatable sequence of activities.",
      properties: [],
    },
    {
      iri: "https://weave.dev/ontology/bpmo#Actor",
      label: "Actor",
      description: "A person or system that performs work.",
      properties: [],
    },
  ],
  relationships: [
    {
      path: "https://weave.dev/ontology/bpmo#performedBy",
      name: "performed by",
      is_relationship: true,
      min_count: 0,
      max_count: null,
      severity: "Violation",
    },
  ],
};

test.describe("Ontology / Types (CE-READ-1 catalogue)", () => {
  test("real navigation renders the kind catalogue as a data table", async ({ page }) => {
    await page.route("**/api/ontology/types", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TYPES_BODY) });
    });

    await loginAndGoToTypes(page);

    await expect(page.getByText("Process")).toBeVisible();
    await expect(page.getByText("Actor")).toBeVisible();
  });

  test.describe("dark theme screenshot", () => {
    test.use({ colorScheme: "dark" });

    test("renders the catalogue in dark mode", async ({ page }) => {
      await page.route("**/api/ontology/types", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TYPES_BODY) });
      });

      await loginAndGoToTypes(page);
      await expect(page.getByText("Process")).toBeVisible();

      await page.screenshot({ path: "test-results/ce-types-dark.png", fullPage: true });
    });
  });
});
