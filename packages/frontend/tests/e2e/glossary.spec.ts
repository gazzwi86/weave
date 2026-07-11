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

const INVOICE_SEARCH_ROW = {
  iri: "urn:term:invoice",
  prefLabel: "Invoice",
  definition: "A billing document.",
  owlRole: "true",
};

const INVOICE_BROWSE_ROW = { ...INVOICE_SEARCH_ROW, broader: "", narrower: "" };

const OBLIGATION_BROWSE_ROW = {
  iri: "urn:term:obligation",
  prefLabel: "Obligation",
  definition: "A binding duty.",
  owlRole: "true",
  broader: "",
  narrower: "",
};

interface SparqlFixture {
  searchRows: unknown[];
  browseRows: unknown[];
}

async function fulfillSparql(route: Route, isBrowse: boolean, fixture: SparqlFixture): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ rows: isBrowse ? fixture.browseRows : fixture.searchRows }),
  });
}

async function routeSparql(page: Page, fixture: Partial<SparqlFixture>): Promise<void> {
  const resolved: SparqlFixture = { searchRows: [], browseRows: [], ...fixture };
  await page.route("**/api/proxy/sparql", async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    await fulfillSparql(route, body.query.includes("GROUP_CONCAT"), resolved);
  });
}

// AC-002-01/-03: search for a known term, see it in results, then find it
// (and its broader/narrower chips) in the ordinary browse list.
test("searches 'invoice', sees the match, then browses the term list (AC-002-01/-03)", async ({
  page,
}) => {
  await routeSparql(page, { browseRows: [INVOICE_BROWSE_ROW], searchRows: [INVOICE_SEARCH_ROW] });

  await loginAndGoToGlossary(page);
  await expect(page.getByTestId("glossary-browse-list")).toContainText("Invoice");

  await page.getByLabel(/search glossary/i).fill("invoice");
  await page.getByRole("button", { name: "Search" }).click();

  const results = page.getByTestId("glossary-search-results");
  await expect(results).toContainText("Invoice");
  await expect(results).toContainText("also class");
});

// AC-002-02: a zero-result search opens the create-term empty-state, which
// posts a real CE-WRITE-1 op batch -- asserts the batch reaches the backend
// proxy (Law B: backend state actually changes), then confirms the new term
// shows up in the browse list.
test("searches a missing term, creates it, and finds it in the browse list (AC-002-02)", async ({
  page,
}) => {
  let applyRequestBody: unknown = null;
  await routeSparql(page, {});
  await page.route("**/api/operations/apply", async (route) => {
    applyRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ref_map: { t1: "urn:term:obligation" } }),
    });
  });

  await loginAndGoToGlossary(page);
  await page.getByLabel(/search glossary/i).fill("obligation");
  await page.getByRole("button", { name: "Search" }).click();

  const emptyState = page.getByTestId("glossary-empty-state");
  await expect(emptyState).toBeVisible();
  await emptyState.getByLabel(/preferred label/i).fill("Obligation");
  await emptyState.getByLabel(/language/i).fill("en");
  await emptyState.getByLabel(/definition/i).fill("A binding duty.");

  // Browse list re-fetch (after create) returns the new term.
  await routeSparql(page, { browseRows: [OBLIGATION_BROWSE_ROW] });
  await emptyState.getByRole("button", { name: "Create term" }).click();

  await expect(page.getByText(/created urn:term:obligation/i)).toBeVisible();
  expect(applyRequestBody).not.toBeNull();
  await expect(page.getByTestId("glossary-browse-list")).toContainText("Obligation");
});

// AC-002-04: a sh:uniqueLang 422 from the same create pipeline renders as a
// plain-language, field-anchored error on the form -- not a raw SHACL dump.
test("creating a duplicate-language term renders the 422 on the form (AC-002-04)", async ({
  page,
}) => {
  await routeSparql(page, {});
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
  await page.getByLabel(/search glossary/i).fill("obligation");
  await page.getByRole("button", { name: "Search" }).click();

  const emptyState = page.getByTestId("glossary-empty-state");
  await emptyState.getByLabel(/preferred label/i).fill("Obligation");
  await emptyState.getByLabel(/language/i).fill("en");
  await emptyState.getByLabel(/definition/i).fill("A binding duty.");
  await emptyState.getByRole("button", { name: "Create term" }).click();

  await expect(page.getByText(/duplicate language tag: en/i)).toBeVisible();
  await expect(page.getByLabel(/preferred label/i)).toHaveAttribute("aria-invalid", "true");
});
