import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors ce-authoring.spec.ts's login helper.
async function loginAndGoToCe(page: Page): Promise<void> {
  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce$/);
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

// TASK-013 AC-002-01/-03/-04/-05: real login/session against the mock OIDC
// + backend, upload -> proposal cards render once extraction reaches
// awaiting-review -> accept/reject call the TASK-012 endpoint contracts.
//
// The ingest API responses are routed (same convention as
// ce-authoring.spec.ts's `/api/operations/apply` mock), not hit against the
// live pipeline -- the extraction leg calls a real local Ollama model
// (build-request.spec.ts: "calls a local LLM and takes minutes" for its own
// LLM-backed pipeline, for the same reason), which is both too slow for a
// CI/sandbox time budget and not deterministic enough to assert exact
// op/label/confidence text against. This spec proves the UI drives the
// exact request/response contract TASK-012 defines (captured URLs below),
// same evidentiary bar as the rest of the authoring E2E suite.
test.describe("CE document ingest", () => {
  test("uploads a document, reviews proposal cards, accepts one and rejects one (AC-002-01/-03/-04/-05)", async ({
    page,
  }) => {
    let jobPollCount = 0;
    const accepted: string[] = [];
    const rejected: string[] = [];

    await page.route("**/api/ingest/artefacts", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ artefact_iri: "urn:a1", job_id: "e2e-job-1" }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-1", async (route) => {
      jobPollCount += 1;
      const status = jobPollCount === 1 ? "extracting" : "awaiting-review";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job_id: "e2e-job-1", status, kind: "document", artefact_iri: "urn:a1", error: null }),
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

    await loginAndGoToCe(page);

    const uploadResponse = page.waitForResponse("**/api/ingest/artefacts");
    await page.setInputFiles("#ce-ingest-upload", {
      name: "runbook.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Runbook\n\n## Customer Onboarding\n\nDescribe onboarding steps."),
    });
    const upload = await uploadResponse;
    expect(upload.status()).toBe(201);

    // AC-002-03: op-list card, matched-resource state, confidence badge,
    // source-span locator all visible.
    await expect(page.getByText(/Add a new Process called "Customer Onboarding"/i)).toBeVisible();
    await expect(page.getByText("Runbook > Customer Onboarding")).toBeVisible();
    await expect(page.getByText("91%")).toBeVisible();

    // AC-002-04: the low-confidence proposal is flagged and its Accept
    // button is present but never pre-selected/auto-triggered.
    await expect(page.getByText(/low confidence/i)).toBeVisible();

    // AC-002-05: accept/reject call the real TASK-012 endpoints per proposal.
    await page.getByRole("listitem").filter({ hasText: "Customer Onboarding" }).getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText(/^accepted$/i)).toBeVisible();
    expect(accepted).toHaveLength(1);

    await page.getByRole("listitem").filter({ hasText: "Vendor Review" }).getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText(/^rejected$/i)).toBeVisible();
    expect(rejected).toHaveLength(1);
  });

  // AC-002-05: a 422 SHACL violation from the real accept contract renders
  // on the offending card instead of silently resolving it.
  test("renders SHACL violations returned from a 422 accept response", async ({ page }) => {
    await page.route("**/api/ingest/artefacts", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ artefact_iri: "urn:a2", job_id: "e2e-job-2" }),
      });
    });
    await page.route("**/api/ingest/jobs/e2e-job-2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ job_id: "e2e-job-2", status: "awaiting-review", kind: "document", artefact_iri: "urn:a2", error: null }),
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
          violations: [{ focus_node: "urn:n1", path: "owner", severity: "Violation", message: "Owner is required" }],
        }),
      });
    });

    await loginAndGoToCe(page);
    await page.setInputFiles("#ce-ingest-upload", {
      name: "runbook.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Runbook\n\n## Customer Onboarding\n"),
    });

    await expect(page.getByText(/Add a new Process called "Customer Onboarding"/i)).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();

    await expect(page.getByText("Owner is required")).toBeVisible();
    // Still pending -- a 422 must never resolve the card as accepted.
    await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();
  });
});
