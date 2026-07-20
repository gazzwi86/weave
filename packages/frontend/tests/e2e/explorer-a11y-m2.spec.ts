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

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = {
  kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }],
  relTypes: [{ id: "hasStep", label: "Has step" }],
};
const ONBOARDING = "https://weave.example/process/onboarding";
const CREATE_ACCOUNT = "https://weave.example/domain/create-account";
const SPARQL_PAGE = {
  rows: [
    { subject: ONBOARDING, predicate: "https://weave.example/hasStep", object: CREATE_ACCOUNT, bpmo_kind: "Process", label: "Customer Onboarding" },
    // A node's human label is its own weave:label triple (ADR-005 --
    // map-rows-to-elements.ts ignores the row-level `label` field), and the
    // search overlay matches on that node label. Without this row the node
    // falls back to its IRI tail ("onboarding") and search finds nothing.
    { subject: ONBOARDING, predicate: "https://weave.io/ontology/label", object: "Customer Onboarding", bpmo_kind: "Process" },
  ],
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

// ControlDock is a single-open accordion: clicking a tab conditionally mounts
// that tab's panel. Axe must not scan mid-mount (transient violations, or a
// clean scan that misses not-yet-attached content), so wait for the panel to
// be attached+visible before scanning. The testid is keyed by tab id, so
// switching tabs waits for the NEW panel to commit -- the wrapper div persists
// across switches, so a generic selector would pass instantly on a swap and
// leave the race. Tab labels are the ids capitalised (Filters->filters, ...).
async function openDockTab(page: Page, tabName: string): Promise<void> {
  await page.getByRole("button", { name: tabName }).click();
  await expect(page.getByTestId(`control-dock-panel-${tabName.toLowerCase()}`)).toBeVisible();
}

test.describe("Explorer M2 panels — axe-core zero-violations (TASK-030 AC-2)", () => {
  // Refit: ControlDock is a single-open accordion -- only the active tab's
  // panel is mounted at all (not just CSS-hidden), so filter/overlay/
  // versions/completeness can no longer be swept in one axe pass. Opens
  // each tab in turn and re-runs axe against whatever it mounts.
  test("filters + overlays + versions + completeness (each ControlDock tab)", async ({ page }) => {
    await mockExplorer(page);
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);

    for (const tabName of ["Filters", "Layers", "Overlays", "Versions"]) {
      await openDockTab(page, tabName);
      await assertNoViolations(page);
    }

    // Overlay legend + completeness notice appear once a toggle is active.
    await openDockTab(page, "Overlays");
    await page.getByRole("switch", { name: "Heatmap: Maturity" }).click();
    // Wait for the legend the toggle reveals (same assertion as
    // explorer-overlays.spec.ts) so axe doesn't race its mount.
    await expect(page.getByText("Heatmap — maturity")).toBeVisible();
    await assertNoViolations(page);
  });

  // SidePanel (edit/save affordances) + CommentsPanel mount on node select.
  // Mounted via the search overlay's result-select (the proven AC-6 flow in
  // explorer-node-spotlight.spec.ts, wired to the same openNode path as a
  // canvas tap) instead of a coordinate `page.mouse.click` on the canvas:
  // cytoscape's hit-test intermittently drops a tap at the node's exact
  // rendered centre (elementFromPoint confirmed CANVAS at identical coords
  // on both passing and failing runs), which was axe-m2's recurring CI
  // flake. This test's job is axe-scanning the mounted panel -- tap-to-open
  // behaviour itself is covered by explorer-node-spotlight.spec.ts.
  test("side panel with comments (save/library/share surface)", async ({ page }) => {
    await mockExplorer(page);
    await loginAndGoToExplorer(page);
    await waitForLayoutSettled(page);
    await page.getByTestId("explorer-search-button").click();
    const overlay = page.getByTestId("explorer-search-overlay");
    await overlay.getByPlaceholder("Search nodes…").fill("Customer");
    await overlay.getByText("Customer Onboarding").click();
    const panel = page.getByTestId("explorer-side-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Customer Onboarding")).toBeVisible();
    await assertNoViolations(page);
  });

  // GraphCanvas's own loading/empty/error states, via TASK-029's standalone
  // bare-host mount route -- outside the Explorer shell chrome.
  test("GraphCanvas states via GE-CANVAS-1 standalone mount", async ({ page }) => {
    await page.goto("/build/ge-canvas-preview?source=g1&mode=force&readonly=true");
    await assertNoViolations(page);
  });
});
