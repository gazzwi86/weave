import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function goToQueryPage(page: Page): Promise<void> {
  await loginAndGoToDashboard(page);
  await page.getByRole("link", { name: "Constitution Engine" }).click();
  await expect(page).toHaveURL(/\/ce\/query$/);
  // Next dev-mode compiles a route on first hit -- wait for that to settle
  // before interacting, or the first action races the in-flight compile.
  await page.waitForLoadState("networkidle");
}

const NL_RESPONSE = {
  sparql_generated:
    "PREFIX weave: <https://weave.io/ontology/>\nSELECT ?p WHERE { GRAPH ?g { ?p a weave:Process . } }",
  rows: [{ p: "https://weave.io/instances/process-1" }],
  column_names: ["p"],
  elapsed_ms: 12.0,
  explanation: null,
  next_page: null,
};

// CE-TASK-007 E7-S1 E2E requirement: ask a question, see the generated
// SPARQL (AC-007-06 transparency) and the result rows (ADR-005 #4 -- LLM
// mocked at the browser network layer, matching billing.spec.ts).
test("asking a question shows the generated SPARQL and result rows (AC-007-01/-06)", async ({
  page,
}) => {
  await page.route("**/api/query/nl**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(NL_RESPONSE),
    });
  });

  await goToQueryPage(page);
  await page.getByLabel("Question").fill("What processes exist?");
  await page.getByRole("button", { name: "Ask" }).click();

  await expect(page.getByTestId("nl-generated-sparql")).toContainText("weave:Process");
  await expect(page.getByTestId("results-table")).toContainText("process-1");
});

// CE-TASK-007 E7-S1 E2E requirement: "copy to editor" carries the model's
// SPARQL into the editor textarea unchanged.
test("copy to editor carries the generated SPARQL into the SPARQL editor", async ({ page }) => {
  await page.route("**/api/query/nl**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(NL_RESPONSE),
    });
  });

  await goToQueryPage(page);
  await page.getByLabel("Question").fill("What processes exist?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("nl-generated-sparql")).toBeVisible();

  await page.getByRole("button", { name: "Copy to editor" }).click();
  await expect(page.getByLabel("SPARQL query")).toHaveValue(NL_RESPONSE.sparql_generated);
});

// CE-TASK-007 E7-S2 E2E requirement: `test_coverage_gap_zero_rows_shows_message`
// -- running the report against a fully-covered graph shows the zero-gap
// message, not an empty table.
test("coverage gap report with no gaps shows the zero-gap message (AC-007-13)", async ({
  page,
}) => {
  await page.route("**/api/sparql**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rows: [], column_names: [], message: "No coverage gaps found" }),
    });
  });

  await goToQueryPage(page);
  await page.getByRole("button", { name: "Run coverage gap report" }).click();

  await expect(page.getByTestId("results-empty")).toContainText("No coverage gaps found");
});
