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
  // PoC IA: Query lives in the Constitution section's left rail.
  await page.getByRole("link", { name: "Constitution" }).click();
  await page
    .getByRole("navigation", { name: "Secondary" })
    .getByRole("link", { name: /^Query/ })
    .click();
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
  grounded_iris: ["https://weave.io/instances/process-1"],
  elapsed_ms: 12.0,
  explanation: null,
  next_page: null,
};

async function stubNlResponse(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route("**/api/query/nl**", async (route) => {
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function askQuestion(page: Page, question: string): Promise<void> {
  await page.getByRole("textbox", { name: "Ask a question" }).fill(question);
  await page.getByRole("button", { name: "Ask" }).click();
}

// CE-V1-TASK-032 AC-1/AC-7/AC-6 E2E requirement:
// `test_analyst_asks_question_sees_progress_then_grounded_graph_result`.
test("asking a question shows progress, grounded graph result, and the executed SPARQL", async ({
  page,
}) => {
  await stubNlResponse(page, NL_RESPONSE);
  await goToQueryPage(page);

  await askQuestion(page, "What processes exist?");
  await expect(page.getByTestId("ask-submitting")).toBeVisible();

  await expect(page.getByTestId("result-frame")).toBeVisible();
  await expect(page.getByTestId("results-table")).toContainText("process-1");

  await page.getByRole("tab", { name: "Graph" }).click();
  await expect(page.getByTestId("grounded-graph-canvas")).toBeVisible();

  await page.getByText("View SPARQL").click();
  await expect(page.getByTestId("view-sparql-disclosure")).toContainText("weave:Process");
});

// AC-2: provider-missing state (503) shows examples, editor stays live.
test("provider-missing state shows examples and keeps the SPARQL editor usable (AC-2)", async ({
  page,
}) => {
  await stubNlResponse(page, { error: "provider_unavailable" }, 503);
  await goToQueryPage(page);

  await askQuestion(page, "What processes exist?");
  await expect(page.getByTestId("ask-provider-missing")).toBeVisible();
  await expect(page.getByText("Who owns Billing?")).toBeVisible();
  await expect(page.getByLabel("SPARQL query")).toBeEditable();
});

// CE-TASK-007 E7-S1 E2E requirement (still applies unchanged): "copy to
// editor" carries the model's SPARQL into the editor textarea unchanged.
test("copy to editor carries the generated SPARQL into the SPARQL editor", async ({ page }) => {
  await stubNlResponse(page, NL_RESPONSE);
  await goToQueryPage(page);

  await askQuestion(page, "What processes exist?");
  await expect(page.getByTestId("result-frame")).toBeVisible();
  await page.getByText("View SPARQL").click();

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
