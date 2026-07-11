import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE (engineer): run green (5/5) against this worktree's real, live
// stack -- Playwright's own webServer-spawned frontend/backend/mock-oidc,
// backend pointed at the weave-ce004 docker-compose containers via
// WEAVE_PG_PORT=5446 WEAVE_REDIS_PORT=6393 (db/pool.py's / sessions.py's
// env-var lookups; those two aren't in .env.example and default to the
// plain 5432/6379 ports another worktree's stack may already hold, so set
// them explicitly when re-running: see docs/specs/weave/dev-environment.md
// for the worktree port-map convention). Real login through the mock OIDC
// provider, app mutations route-mocked at the network layer (Law B
// backend-state proof via the captured request body), matching
// ce-authoring.spec.ts's established pattern.

// Mirrors ce-authoring.spec.ts's loginAndGoToCe, then follows the nav to
// /ce/brand (same secondary-nav-click pattern as ce-query.spec.ts's
// goToQueryPage -- proves the page is nav-reachable, not just goto-able).
async function loginAndGoToBrand(page: Page): Promise<void> {
  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce$/);
  await page
    .getByRole("navigation", { name: "Secondary" })
    .getByRole("link", { name: /Brand & voice/ })
    .click();
  await expect(page).toHaveURL(/\/ce\/brand$/);
  await page.waitForLoadState("networkidle");
}

// Flat-row shape POST /api/proxy/sparql returns (see queries.ts's SparqlRow
// docstring) -- one standard row and one voice-rule row, enough to prove
// the list mounts real data for both tabs (AC-004-03).
async function routeSparqlList(page: Page, extraStandardRows: Record<string, string>[] = []): Promise<void> {
  await page.route("**/api/proxy/sparql", async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    const isVoiceRule = body.query.includes("ruleId");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: isVoiceRule
          ? [
              {
                s: "urn:weave:instances:vr-1",
                ruleId: "no-jargon",
                severity: "critical",
                assertion: "forbidden-term:synergy",
              },
            ]
          : [
              {
                s: "urn:weave:instances:bs-1",
                contentType: "acme.tone",
                effectiveDate: "2026-01-01",
                owner: "Brand Team",
              },
              ...extraStandardRows,
            ],
      }),
    });
  });
}

test.describe("Brand & voice authoring (TASK-004)", () => {
  // AC-004-03: both tabs' lists render real rows from CE-READ-1 (SPARQL
  // proxy), not a stub -- proves the page is mounted + reachable via nav,
  // not orphaned (Law 17).
  test("views brand standards and voice rules from the nav (AC-004-03)", async ({ page }) => {
    await routeSparqlList(page);
    await loginAndGoToBrand(page);

    await expect(page.getByTestId("standard-list")).toContainText("acme.tone");

    await page.getByRole("tab", { name: /voice rules/i }).click();
    await expect(page.getByTestId("voice-rule-list")).toContainText("no-jargon");
  });

  // AC-004-01: creates a BrandStandard via CE-WRITE-1; the exact mutation
  // dispatched is the Law 16 backend-state proof (same style as
  // ce-authoring.spec.ts's captured.applyBody), and the just-created row
  // shows up in a re-list without a manual reload.
  test("authors a BrandStandard, sees it committed and re-listed (AC-004-01)", async ({ page }) => {
    type ApplyBody = { operations: { op: string; kind?: string; properties?: Record<string, string> }[] };
    const captured: { applyBody: ApplyBody | null } = { applyBody: null };
    let listCallCount = 0;

    await page.route("**/api/proxy/sparql", async (route) => {
      listCallCount += 1;
      const rows =
        listCallCount === 1
          ? [{ s: "urn:weave:instances:bs-1", contentType: "acme.tone", effectiveDate: "2026-01-01", owner: "Brand Team" }]
          : [
              { s: "urn:weave:instances:bs-1", contentType: "acme.tone", effectiveDate: "2026-01-01", owner: "Brand Team" },
              { s: "urn:weave:instances:bs-2", contentType: "acme.new-tone", effectiveDate: "2026-02-01", owner: "Brand Team" },
            ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows }) });
    });
    await page.route("**/api/operations/apply", async (route) => {
      captured.applyBody = route.request().postDataJSON() as ApplyBody;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ref_map: { form1: "urn:weave:instances:bs-2" }, version_iri: "urn:weave:versions:v2" }),
      });
    });

    await loginAndGoToBrand(page);
    await expect(page.getByTestId("standard-list")).toContainText("acme.tone");

    await page.getByLabel(/content type/i).fill("acme.new-tone");
    await page.getByLabel(/content body/i).fill("Always say hello warmly.");
    await page.getByLabel(/effective date/i).fill("2026-02-01");
    await page.getByLabel(/^owner$/i).fill("Brand Team");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/Committed as version urn:weave:versions:v2/)).toBeVisible();
    // Backend-state proof (Law 16): the exact mutation the UI dispatched.
    expect(captured.applyBody?.operations[0]).toMatchObject({
      op: "add_node",
      kind: "https://weave.io/ontology/BrandStandard",
      properties: {
        "https://weave.io/ontology/contentType": "acme.new-tone",
        "https://weave.io/ontology/effectiveDate": "2026-02-01",
        "https://weave.io/ontology/owner": "Brand Team",
      },
    });
    // A second, independent SPARQL call re-lists after commit -- the row
    // that comes back is the mocked backend's post-write state, not a
    // client-side optimistic splice.
    await page.getByRole("tab", { name: /standards/i }).click();
    await expect(page.getByTestId("standard-list")).toContainText("acme.new-tone");
  });

  // AC-004-02: a missing assertion 422s and field-anchors onto the
  // assertion value field (submit-op.ts's violation.path mapping) --
  // matches the task brief's E2E scenario verbatim.
  test("authors a VoiceRule with a missing assertion -- 422 field-anchors (AC-004-02)", async ({ page }) => {
    await routeSparqlList(page);
    await page.route("**/api/operations/apply", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          violations: [{ path: "https://weave.io/ontology/assertion", message: "assertion is required" }],
        }),
      });
    });

    await loginAndGoToBrand(page);
    await page.getByRole("tab", { name: /voice rules/i }).click();
    await expect(page.getByTestId("voice-rule-list")).toContainText("no-jargon");

    await page.getByLabel(/rule id/i).fill("no-emoji");
    await page.getByLabel(/severity/i).selectOption("critical");
    // A whitespace-only value clears the HTML5 `required` blocker (a
    // non-empty string) but still means "no real assertion" server-side --
    // the mocked 422 below is what a real backend would return for it.
    await page.getByLabel(/assertion value/i).fill(" ");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("assertion is required")).toBeVisible();
    await expect(page.getByLabel(/assertion value/i)).toHaveAttribute("aria-invalid", "true");
    // No "Created …" success text -- the form stayed open, no commit happened.
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  // AC-004-02/-03: task brief's named E2E scenario verbatim -- a
  // successfully-created voice rule appears in the re-listed rows carrying
  // its real PROV-O attribution (attribution.ts's localStorage record,
  // written by voice-rule-form.tsx right after the 201), not a stubbed
  // "unknown actor" -- the mock's ref_map IRI matches the re-list's `s`
  // value on purpose, so this only passes if that wiring is real.
  test("creates a voice rule; it appears in the list with attribution (AC-004-02/-03)", async ({ page }) => {
    let listCallCount = 0;
    await page.route("**/api/proxy/sparql", async (route) => {
      listCallCount += 1;
      const rows =
        listCallCount === 1
          ? [{ s: "urn:weave:instances:vr-1", ruleId: "no-jargon", severity: "critical", assertion: "forbidden-term:synergy" }]
          : [
              { s: "urn:weave:instances:vr-1", ruleId: "no-jargon", severity: "critical", assertion: "forbidden-term:synergy" },
              { s: "urn:weave:instances:vr-2", ruleId: "no-emoji", severity: "normal", assertion: "regex:[^\\x{1F300}-\\x{1FAFF}]" },
            ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rows }) });
    });
    await page.route("**/api/operations/apply", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ref_map: { form1: "urn:weave:instances:vr-2" }, version_iri: "urn:weave:versions:v9" }),
      });
    });
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { email: "brand-owner@example.com" } }),
      });
    });

    await loginAndGoToBrand(page);
    await page.getByRole("tab", { name: /voice rules/i }).click();
    await page.getByLabel(/rule id/i).fill("no-emoji");
    await page.getByLabel(/severity/i).selectOption("normal");
    await page.getByLabel(/assertion value/i).fill("[^\\x{1F300}-\\x{1FAFF}]");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Created urn:weave:instances:vr-2.")).toBeVisible();

    await page.getByRole("tab", { name: /voice rules/i }).click();
    const row = page.getByTestId("voice-rule-list").getByText("no-emoji").locator("..");
    await expect(row).toContainText("brand-owner@example.com");
  });

  // AC-004-04: extraction always 503s today (E4-S2 deferred) but the forms
  // beside it stay fully usable -- FR-024 graceful degradation.
  test("extraction affordance 503s; owner completes the same content via the form (AC-004-04)", async ({ page }) => {
    await routeSparqlList(page);
    await page.route("**/api/proxy/brand/extract", async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    });
    let applyCalled = false;
    await page.route("**/api/operations/apply", async (route) => {
      applyCalled = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ref_map: { form1: "urn:weave:instances:bs-2" }, version_iri: "urn:weave:versions:v2" }),
      });
    });

    await loginAndGoToBrand(page);
    await page.getByRole("button", { name: /extract from source/i }).click();
    await expect(page.getByText(/extraction isn.t available yet/i)).toBeVisible();

    await page.getByLabel(/content type/i).fill("acme.new-tone");
    await page.getByLabel(/content body/i).fill("Always say hello warmly.");
    await page.getByLabel(/effective date/i).fill("2026-02-01");
    await page.getByLabel(/^owner$/i).fill("Brand Team");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/Committed as version urn:weave:versions:v2/)).toBeVisible();
    expect(applyCalled).toBe(true);
  });
});
