import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors explorer-overlays.spec.ts's login/mock helpers -- same canvas,
// same shared shell TASK-022 mounts the Versions Panel into.
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

const JSON_CONTENT_TYPE = "application/json";

const VERSIONS = [
  { version_iri: "urn:workspace:demo:v2", semver: "1.1.0", published_at: "2026-07-02T00:00:00Z", is_latest: true },
  { version_iri: "urn:workspace:demo:v1", semver: "1.0.0", published_at: "2026-06-01T00:00:00Z", is_latest: false },
];

const DIFF = {
  added: [{ subject: "urn:workspace:demo:process/new-step", predicate: "urn:rdf:label", object: "New step" }],
  removed: [{ subject: "urn:workspace:demo:process/old-step", predicate: "urn:rdf:label", object: "Old step" }],
  modified: [
    {
      subject: "urn:workspace:demo:process/onboarding",
      predicate: "https://weave.example/hasStep",
      before: "urn:workspace:demo:process/old-step",
      after: "urn:workspace:demo:process/new-step",
    },
  ],
};

const ONTOLOGY_TYPES = {
  relationships: [{ path: "https://weave.example/hasStep", label: "has step" }],
};

async function mockVersionsAndDiff(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify({ kinds: [] }) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ rows: [], columns: [], has_more_pages: false, page: 0 }),
    });
  });
  await page.route("**/api/proxy/ontology/versions**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(VERSIONS) });
  });
  await page.route("**/api/proxy/ontology/diff**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(DIFF) });
  });
  await page.route("**/api/proxy/ontology/types", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(ONTOLOGY_TYPES) });
  });
}

test.describe("Explorer -- Versions Panel + Diff (TASK-022)", () => {
  test.beforeEach(async ({ page }) => {
    await mockVersionsAndDiff(page);
  });

  // AC-3/AC-6: two-version compare highlights added/removed/modified
  // (incl. an edge modification) and the diff can be exported as JSON.
  test("should select two versions, see the diff overlay incl. an edge modification, export JSON", async ({ page }) => {
    await loginAndGoToExplorer(page);

    await expect(page.getByTestId("explorer-versions-panel")).toBeVisible();
    await page.getByRole("button", { name: "Select 1.0.0 for comparison" }).click();
    await page.getByRole("button", { name: /Select 1.1.0 \(latest\) for comparison/ }).click();

    await expect(page.getByText(/Added: 1.*Removed: 1.*Modified: 1/)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export diff (JSON)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("diff-");
  });

  // AC-2/AC-8: loading a published version is read-only (no edit
  // affordances), and returning to draft restores editing.
  test("should load a published version, find no edit affordances, return to draft and edit again", async ({ page }) => {
    await loginAndGoToExplorer(page);

    await expect(page.getByRole("button", { name: "Reset layout" })).toBeVisible();

    await page.getByRole("button", { name: "Load version 1.0.0 read-only" }).click();
    await expect(page.getByRole("button", { name: "Return to draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset layout" })).toHaveCount(0);

    await page.getByRole("button", { name: "Return to draft" }).click();
    await expect(page.getByRole("button", { name: "Reset layout" })).toBeVisible();
  });
});
