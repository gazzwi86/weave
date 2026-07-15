import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// TASK-030 AC-2: zero axe-core violations on every M2 panel/dialog
// (filters, overlays legend, versions, save/library/share, comments,
// completeness panel, GraphCanvas states). CI job `axe-m2` in ci.yml runs
// this file. Same fixture-page-per-test pattern as accessibility.spec.ts
// (@axe-core/playwright needs the fixture context to inject its script).
//
// Filter/overlay/versions/completeness panels are always-mounted controls
// (not opened via a toggle button -- confirmed against
// explorer-filters-layers.spec.ts / explorer-overlays.spec.ts /
// explorer-versions-diff.spec.ts), so most of this file is one combined
// scan with everything on screen at once, plus SidePanel (comments/save)
// opened the same way explorer-node-spotlight.spec.ts does (click a node).
// Mirrors those files' own local, non-exported login + mock helpers (this
// repo's convention -- no cross-spec-file sharing).
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

async function waitOneAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
  await waitOneAnimationFrame(page);
  await waitOneAnimationFrame(page);
}

async function clickNode(page: Page, nodeId: string): Promise<void> {
  const info = await page.evaluate((id) => window.__explorerNodeInfo?.(id), nodeId);
  if (!info) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.click(info.x, info.y);
}

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = {
  kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }],
  relTypes: [{ id: "hasStep", label: "Has step" }],
};
const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/domain/create-account";
const SPARQL_PAGE = {
  rows: [{ subject: ONBOARDING, predicate: "https://weave.example/hasStep", object: CREATE_ACCOUNT, bpmo_kind: "Process", label: "Customer Onboarding" }],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};
// GET /api/proxy/ontology/versions returns a bare VersionEntry[] (see
// lib/explorer/versions/fetch-versions.ts), not a { versions: [...] }
// envelope -- wrapping it here was the bug (versions.map crashed on the
// real page, VersionsPanel got the wrapper object instead of the array).
const VERSIONS = [{ version_iri: "v1", semver: "1.0.0", published_at: "2026-07-01T00:00:00Z", is_latest: true }];
const ce_resource_route = "**/api/proxy/ontology/resource/**";

async function mockExplorer(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(SPARQL_PAGE) });
  });
  await page.route("**/api/proxy/ontology/versions**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(VERSIONS) });
  });
  await page.route(ce_resource_route, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({
        label: "Customer Onboarding",
        type_label: "Process",
        bpmo_kind: "Process",
        key_properties: [{ path: "owner", label: "Owner", value: "Ops Team" }],
        raw_iri: null,
      }),
    });
  });
  await page.route("**/api/proxy/explorer/comments**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify({ comments: [] }) });
  });
  // ONB-TASK-008's OnboardingHintsHost mounts a first-visit "Welcome to
  // Explorer" modal whenever no dismissal row exists for this area -- it
  // was blocking every click in this file (real product feature landed
  // after this spec was written, not a flake). Mark it already-dismissed,
  // same pattern explorer-completeness-tour.spec.ts uses for /api/onboarding/path.
  await page.route("**/api/onboarding/path", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({
        role_path: "business",
        path_variant: "default",
        path_chosen_manually: false,
        needs_choice: false,
      }),
    });
  });
  await page.route("**/api/onboarding/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ dismissals: [{ kind: "welcome_modal", ref_id: "welcome-explorer" }] }),
    });
  });
}

async function assertNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("Explorer M2 panels — axe-core zero-violations (TASK-030 AC-2)", () => {
  // Covers filter panel, overlay legend, versions panel and completeness
  // notice in one pass -- all four are always-mounted controls, so one
  // fully-loaded page IS the "every panel visible" state.
  test("filters + overlays + versions + completeness (always-mounted panels)", async ({ page }) => {
    await mockExplorer(page);
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await page.getByRole("switch", { name: "Heatmap: Maturity" }).click();
    await assertNoViolations(page);
  });

  // SidePanel (edit/save affordances) + CommentsPanel mount on node click.
  test("side panel with comments (save/library/share surface)", async ({ page }) => {
    await mockExplorer(page);
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await clickNode(page, ONBOARDING);
    await expect(page.getByText("Customer Onboarding")).toBeVisible();
    await assertNoViolations(page);
  });

  // GraphCanvas's own loading/empty/error states, via TASK-029's standalone
  // bare-host mount route -- outside the Explorer shell chrome.
  test("GraphCanvas states via GE-CANVAS-1 standalone mount", async ({ page }) => {
    await page.goto("/build/ge-canvas-preview?source=g1&mode=force&readonly=true");
    await assertNoViolations(page);
  });
});
