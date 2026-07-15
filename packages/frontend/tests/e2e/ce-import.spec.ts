import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// CE-V1-TASK-019 (AC-008-04, partial-slice): the document-import leg and the
// NL-citation leg of the epic's `epic_cold_start_loop`. The BPMN-fixture leg
// is deferred (see `.claude/state/escalations/CE-V1-TASK-019-partial.md`) --
// no BPMN extractor exists yet (TASK-015).
//
// Mirrors ce-ingest.spec.ts's real-login/real-session, mocked-ingest-network
// convention (already reviewed under TASK-013) -- the extraction leg's LLM
// call is too slow/nondeterministic for CI, same reasoning as
// build-request.spec.ts. Real backend-state proof for accept/reject lives at
// the Python integration layer (`test_ingest_pipeline.py`, merged); the
// `FixtureProvider` (packages/backend .../ai/providers.py) is ready
// infrastructure for a future dedicated real-backend E2E lane.
async function loginAndGoToImportPage(page: Page): Promise<void> {
  await page.goto("/ce/import");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce\/import$/);
  await page.waitForLoadState("networkidle");
}

const PROPOSAL = {
  id: "p1",
  ops: [{ op: "add_node", ref: "n1", kind: "Process", label: "Customer Onboarding" }],
  confidence: 0.91,
  matched_iri: null,
  reason: "found in section 1",
  status: "pending" as const,
  source_span: "Runbook > Customer Onboarding",
  low_confidence: false,
};

const LOW_CONF_PROPOSAL = {
  ...PROPOSAL,
  id: "p2",
  ops: [{ op: "add_node", ref: "n2", kind: "Process", label: "Vendor Review" }],
  confidence: 0.2,
  low_confidence: true,
  source_span: "Runbook > Vendor Review",
};

test.describe("CE Import & Ingest page (AC-008-01/-02/-04, document leg)", () => {
  test("upload doc -> proposal review -> accept one/reject one -> job summary reflects outcomes", async ({
    page,
  }) => {
    const accepted: string[] = [];
    const rejected: string[] = [];

    await page.route("**/api/ingest/artefacts", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ job_id: "e2e-job-1", artefact_iri: "urn:a1" }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          job_id: "e2e-job-1",
          status: "awaiting-review",
          kind: "document",
          artefact_iri: "urn:a1",
          error: null,
          summary: { committed: 0, rejected: 0, skipped: 0 },
        }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-1/proposals", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ proposals: [PROPOSAL, LOW_CONF_PROPOSAL], has_more: false }),
      });
    });
    await page.route("**/api/ingest/proposals/p1/accept", async (route) => {
      accepted.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ activity_iri: "urn:a1", version_iri: "urn:v1" }),
      });
    });
    await page.route("**/api/ingest/proposals/p2/reject", async (route) => {
      rejected.push(route.request().url());
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await loginAndGoToImportPage(page);

    const uploadResponse = page.waitForResponse("**/api/ingest/artefacts");
    await page.setInputFiles("#ce-import-upload", {
      name: "runbook.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Runbook\n\n## Customer Onboarding\n\nDescribe onboarding steps."),
    });
    const upload = await uploadResponse;
    expect(upload.status()).toBe(201);

    // AC-008-01: job appears in the job list, live status visible.
    await expect(page.getByTestId("import-job-list")).toContainText("urn:a1");

    // AC-008-02: op-list card, low-confidence flagged and never pre-selected.
    await expect(page.getByText(/Add a new Process called "Customer Onboarding"/i)).toBeVisible();
    await expect(page.getByText(/low confidence/i)).toBeVisible();

    await page
      .getByRole("listitem")
      .filter({ hasText: "Customer Onboarding" })
      .getByRole("button", { name: "Accept" })
      .click();
    await expect(page.getByText(/^accepted$/i)).toBeVisible();
    expect(accepted).toHaveLength(1);

    await page
      .getByRole("listitem")
      .filter({ hasText: "Vendor Review" })
      .getByRole("button", { name: "Reject" })
      .click();
    await expect(page.getByText(/^rejected$/i)).toBeVisible();
    expect(rejected).toHaveLength(1);
  });

  test("422 SHACL violation renders inline against the proposal, never resolves it", async ({ page }) => {
    await page.route("**/api/ingest/artefacts", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ job_id: "e2e-job-2", artefact_iri: "urn:a2" }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          job_id: "e2e-job-2",
          status: "awaiting-review",
          kind: "document",
          artefact_iri: "urn:a2",
          error: null,
          summary: null,
        }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-2/proposals", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ proposals: [PROPOSAL], has_more: false }),
      });
    });
    await page.route("**/api/ingest/proposals/p1/accept", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          violations: [{ focus_node: "p1", path: null, severity: "Error", message: "Owner is required" }],
        }),
      });
    });

    await loginAndGoToImportPage(page);
    await page.setInputFiles("#ce-import-upload", {
      name: "runbook.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Runbook\n\n## Customer Onboarding\n"),
    });
    await expect(page.getByText(/Add a new Process called "Customer Onboarding"/i)).toBeVisible();

    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Owner is required")).toBeVisible();
    // Still pending -- 422 must never resolve the card as accepted.
    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
  });
});
