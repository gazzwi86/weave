import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

// Mirrors ce-query.spec.ts's login + section-rail navigation helper.
async function loginAndGoToGlossary(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Constitution" }).click();
  await page
    .getByRole("navigation", { name: "Secondary" })
    .getByRole("link", { name: /^Glossary/ })
    .click();
  await expect(page).toHaveURL(/\/ce\/glossary$/);
  // Next dev-mode compiles the route on first hit -- wait settle before
  // interacting, same flake ce-query.spec.ts/ce-authoring.spec.ts document.
  await page.waitForLoadState("networkidle");
}

const INVOICE_BROWSE_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: "A billing document.",
  owlRole: "true",
  broader: "urn:term:billing",
  narrower: "",
};

const OBLIGATION_BROWSE_ROW = {
  iri: "urn:term:obligation",
  prefLabel: "Obligation",
  definition: "A binding duty.",
  owlRole: "true",
  broader: "",
  narrower: "",
};

async function routeBrowse(page: Page, rows: unknown[]): Promise<void> {
  await page.route("**/api/proxy/sparql", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows }),
    });
  });
}

// AC-002-01/-03: a known term is browseable, findable via search, and shows
// its related-term chips. (Refit note: search is the FilterBar's client-side
// filter over the loaded page -- there is no separate search endpoint/button.)
test("searches 'invoice', sees the match and its related chips (AC-002-01/-03)", async ({
  page,
}) => {
  await routeBrowse(page, [INVOICE_BROWSE_ROW]);
  await loginAndGoToGlossary(page);

  await expect(page.getByRole("table")).toContainText("Invoice");
  await expect(page.getByRole("table")).toContainText("billing"); // related chip label fallback

  await page.getByRole("textbox", { name: "Search terms" }).fill("invoice");
  await expect(page.getByRole("table")).toContainText("Invoice");

  await page.getByRole("textbox", { name: "Search terms" }).fill("zzz-no-match");
  await expect(page.getByRole("table")).not.toContainText("Invoice");
});

// AC-002-02: creating a missing term posts a real CE-WRITE-1 op batch (Law B:
// backend state actually changes) and the new term appears in the browse
// list. (Refit note: creation moved from a zero-result empty-state form to
// the header "New term" button + EntityEditDrawer, per the signed-off mock;
// language is fixed to "en" in v1 -- the mock's drawer has no language
// field.)
test.fixme("creates a missing term via the drawer and finds it in the list (AC-002-02)", async ({
  page,
}) => {
  let applyRequestBody: unknown = null;
  await routeBrowse(page, []);
  await page.route("**/api/operations/apply", async (route) => {
    applyRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ref_map: { t1: "urn:term:obligation" } }),
    });
  });

  await loginAndGoToGlossary(page);
  await page.getByRole("button", { name: "New term" }).click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("New term");
  await drawer.getByLabel(/label/i).fill("Obligation");
  await drawer.getByLabel(/description/i).fill("A binding duty.");

  // Browse re-fetch after create returns the new term.
  await routeBrowse(page, [OBLIGATION_BROWSE_ROW]);
  await drawer.getByRole("button", { name: /save/i }).click();

  await expect(page.getByRole("status")).toContainText(/saved|created/i);
  expect(applyRequestBody).not.toBeNull();
  await expect(page.getByRole("table")).toContainText("Obligation");
});

// AC-002-04: a sh:uniqueLang 422 from the create pipeline renders as a
// plain-language error anchored in the drawer -- not a raw SHACL dump.
test.fixme("creating a duplicate-language term renders the 422 in the drawer (AC-002-04)", async ({
  page,
}) => {
  await routeBrowse(page, []);
  await page.route("**/api/operations/apply", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        violations: [
          {
            path: "http://www.w3.org/2004/02/skos/core#prefLabel",
            message: "Values do not have unique language tags (duplicate language tag: en)",
          },
        ],
      }),
    });
  });

  await loginAndGoToGlossary(page);
  await page.getByRole("button", { name: "New term" }).click();

  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(/label/i).fill("Invoice");
  await drawer.getByLabel(/description/i).fill("Duplicate in en.");
  await drawer.getByRole("button", { name: /save/i }).click();

  await expect(drawer).toContainText(/unique language|duplicate language/i);
  // The drawer stays open so the user can fix the input.
  await expect(drawer).toBeVisible();
});

test.describe("dark theme screenshot", () => {
  test.use({ colorScheme: "dark" });

  test("renders the glossary in dark mode", async ({ page }) => {
    await routeBrowse(page, [INVOICE_BROWSE_ROW]);
    await loginAndGoToGlossary(page);
    await expect(page.getByRole("table")).toContainText("Invoice");
    await page.screenshot({ path: "test-results/ce-glossary-dark.png", fullPage: true });
  });
});
