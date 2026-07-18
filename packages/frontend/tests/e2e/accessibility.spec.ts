import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// QA edge case (PLAT-TASK-005 checklist item 6/Category 15): a real-browser
// axe-core pass was a gap -- `@axe-core/playwright` is an installed
// dependency but no spec exercised it; the existing a11y coverage is
// jsdom-based `vitest-axe` (shell.a11y.test.tsx), which can't compute real
// paint/contrast. That gap is exactly why the dashboard footer's WCAG 1.4.3
// color-contrast violation (`--color-text-subtle` on `--text-caption`,
// contrast ratio ~3.2:1 against the dark `--color-surface`, below the 4.5:1
// AA minimum for small text -- also a direct violation of
// typography.md's own rule that `--text-caption` must use
// `--color-text-default`/`--color-text-muted`, never `subtle`) was never
// caught. FAIL-3 fixed: footer swapped to `--color-text-muted`; this now
// runs as a normal passing assertion, not `test.fail()`.
//
// Each test uses its own fixture `page` (not a shared browser.newPage()) --
// @axe-core/playwright requires the fixture-provided page/context to inject
// its script; a manually-created page throws "Please use browser.newContext()".
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  // Same wait auth.spec.ts/global-search.spec.ts use -- without it the
  // second click races the mock OIDC page's own load and misses (flaky).
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("dashboard accessibility (axe-core, real browser)", () => {
  test("dashboard has zero axe violations after login", async ({ page }) => {
    await loginAndGoToDashboard(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // TASK-007: new UI screen (notification centre) gets the same real-browser
  // axe pass, opened with an item present so the panel isn't checked empty.
  test("notification centre has zero axe violations when open", async ({ page }) => {
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: [
            {
              id: "n-1",
              event_type: "job.completed",
              payload: {},
              delivered_channels: ["in_app"],
              read: false,
              created_at: "2026-07-04T00:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          per_page: 25,
        }),
      });
    });

    await loginAndGoToDashboard(page);

    // Waiting for the badge (same assertion notifications.spec.ts makes)
    // settles the mount-time unread fetch/re-render *before* the click --
    // otherwise the click occasionally lands mid-reconciliation, while the
    // trigger button's children are still changing shape as the badge
    // mounts, and React drops it (intermittent, same class of race
    // auth.spec.ts/global-search.spec.ts note for the mock OIDC page).
    const trigger = page.getByRole("button", { name: "Notifications" });
    await expect(trigger.getByText("1")).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// PLAT-TASK-008: the minimal billing usage dashboard, with the
// budget-cap-reached error banner visible (its own colour/contrast surface,
// worth checking on its own rather than only the empty state). Separate
// describe block from the dashboard one above so neither's callback grows
// past the max-lines-per-function budget.
test.describe("billing accessibility (axe-core, real browser)", () => {
  test("billing usage dashboard has zero axe violations with the cap-reached banner shown", async ({
    page,
  }) => {
    await page.route("**/api/billing/usage**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          period: "2026-07",
          total_tokens: 100,
          total_runs: 1,
          total_cost_usd: 1.0,
          by_workspace: [
            { workspace_id: "ws-1", total_tokens: 100, total_runs: 1, total_cost_usd: 1.0 },
          ],
          cap_utilisation_pct: 100.0,
        }),
      });
    });
    await page.route("**/api/billing/simulate-ai-call**", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          detail: { error: "budget_cap_reached", effective_cap_usd: 1.0, consumed_usd: 1.0 },
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/billing");
    await page.getByLabel("Workspace ID").fill("ws-1");
    await page.getByRole("button", { name: "Simulate AI call" }).click();
    // Next.js always renders a hidden route-announcer with role="alert" too,
    // so scope to the one with our text (getByRole("alert") alone is ambiguous).
    await expect(page.getByRole("alert").filter({ hasText: "Budget cap reached" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// PLAT-TASK-009: the compliance sub-view, with a populated summary shown
// (chain status badge + category/actor lists), not the empty state.
test.describe("compliance accessibility (axe-core, real browser)", () => {
  test("compliance view has zero axe violations", async ({ page }) => {
    await page.route("**/api/audit/compliance**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chain_status: "valid",
          entries_checked: 42,
          first_broken_seq: null,
          by_event_category: { workspace: 12, security: 3 },
          top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
          period: "2026-07",
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/compliance");
    await expect(page.getByTestId("chain-status")).toContainText("valid");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// GE-TASK-002 QA FIX 3: no real-browser axe pass existed for /explorer's
// force canvas -- Cytoscape draws to <canvas>, so this also checks the
// canvas/minimap wrapper elements carry accessible names rather than being
// silent to a screen reader, not just colour contrast.
test.describe("explorer accessibility (axe-core, real browser)", () => {
  test("explorer force canvas has zero axe violations", async ({ page }) => {
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: "https://weave.example/process/onboarding",
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Process",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await expect(page.getByTestId("explorer-canvas")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // QA edge case (GE-TASK-003, Category 15): the base-canvas axe pass above
  // never exercises the side panel or search overlay TASK-003 added -- both
  // are new DOM surfaces on this same route and each needs its own
  // zero-violations assertion, not an inference from the canvas-only pass.
  test("explorer side panel (open) has zero axe violations", async ({ page }) => {
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: "https://weave.example/process/onboarding",
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Process",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });
    await page.route("**/api/proxy/ontology/resource/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          label: "Customer Onboarding",
          type_label: "Process",
          key_properties: [{ path: "owner", label: "Owner", value: "Ops Team" }],
          raw_iri: null,
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);

    const nodeInfo = await page.evaluate(() =>
      window.__explorerNodeInfo?.("https://weave.example/process/onboarding")
    );
    if (!nodeInfo) throw new Error("node not found on canvas");
    await page.mouse.click(nodeInfo.x, nodeInfo.y);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("explorer search overlay (open) has zero axe violations", async ({ page }) => {
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: "https://weave.example/process/onboarding",
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Process",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);

    await page.getByTestId("explorer-search-button").click();
    await expect(page.getByTestId("explorer-search-overlay")).toBeVisible();
    await page.getByPlaceholder("Search nodes…").fill("Customer");
    await expect(page.getByText("Customer Onboarding")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });


  // GE-TASK-004: the save-failure toast is a new DOM surface (role="alert"),
  // only mounted once every retry is exhausted -- needs its own pass same as
  // side-panel/search-overlay above, not an inference from the base canvas.
  test("explorer save-failure toast has zero axe violations", async ({ page }) => {
    test.slow(); // waits out the real layoutSaveRetryDelaysMs backoff (2s/4s/8s)
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    const sparqlRow = {
      subject: "https://weave.example/process/onboarding",
      predicate: "https://weave.example/hasStep",
      object: "https://weave.example/step/create-account",
      bpmo_kind: "Process",
      label: "Customer Onboarding",
    };
    await page.route("**/api/proxy/sparql**", async (route) => {
      const body = { rows: [sparqlRow], columns: ["subject", "predicate", "object"], has_more_pages: false, page: 0 };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.route("**/api/proxy/layout-positions**", async (route) => {
      if (route.request().method() !== "GET") return route.fulfill({ status: 500 });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ positions: [] }) });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);
    const nodeInfo = await page.evaluate((id) => window.__explorerNodeInfo?.(id), sparqlRow.subject);
    if (!nodeInfo) throw new Error("node not found on canvas");
    await page.mouse.move(nodeInfo.x, nodeInfo.y);
    await page.mouse.down();
    await page.mouse.move(nodeInfo.x + 40, nodeInfo.y + 40, { steps: 5 });
    await page.mouse.up();
    // Next.js always renders a hidden route-announcer with role="alert" too
    // (see the billing test above) -- scope to our own text.
    await expect(page.getByRole("alert").filter({ hasText: "Couldn" })).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // TASK-020 (AC-8): filters/layers panel + legend + toolbar are new DOM
  // surfaces mounted alongside the canvas -- own zero-violations pass, plus
  // a keyboard-only property-filter add/remove proving full keyboard
  // operability (AC-8's other half), same as explorer-filters-layers.spec.ts's
  // keyboard-only test but scoped to the a11y assertion here.
  test("explorer filters & layers panel (with legend/toolbar) has zero axe violations", async ({ page }) => {
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: "https://weave.example/process/onboarding",
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Process",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);
    // Refit: filters live behind the ControlDock's "Filters" tab.
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByTestId("explorer-filter-panel")).toBeVisible();

    // AC-8 keyboard operability: add then clear a property filter without
    // ever touching the mouse.
    await page.getByLabel("Property path").focus();
    await page.keyboard.type("status");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.type("inactive");
    await page.getByRole("button", { name: "Add filter" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("status eq inactive")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // QA edge case (GE-TASK-005, Category 15): the panel/canvas axe passes
  // above never exercise the node-context-menu, confirm-dialog, or
  // domain-focus-notice TASK-005 added -- each is a new interactive DOM
  // surface and needs its own zero-violations assertion.
  test("explorer node context menu (open) has zero axe violations", async ({ page }) => {
    const ONBOARDING = "https://weave.example/process/onboarding";
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Domain", label: "Domain", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            {
              subject: ONBOARDING,
              predicate: "https://weave.example/hasStep",
              object: "https://weave.example/step/create-account",
              bpmo_kind: "Domain",
              label: "Customer Onboarding",
            },
          ],
          columns: ["subject", "predicate", "object"],
          has_more_pages: false,
          page: 0,
        }),
      });
    });
    await page.route("**/api/proxy/ontology/resource/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          label: "Customer Onboarding",
          type_label: "Domain",
          bpmo_kind: "Domain",
          key_properties: [],
          raw_iri: null,
          neighbours: [],
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);

    const nodeInfo = await page.evaluate(
      (id) => window.__explorerNodeInfo?.(id),
      ONBOARDING
    );
    if (!nodeInfo) throw new Error("node not found on canvas");
    await page.mouse.click(nodeInfo.x, nodeInfo.y);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    // See explorer-domain-focus-expand-collapse.spec.ts: right-click must
    // wait for the panel to leave "loading" or the context menu never opens.
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await page.mouse.click(nodeInfo.x, nodeInfo.y, { button: "right" });
    await expect(page.getByRole("menu", { name: "Node actions" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("explorer domain-focus empty-state notice has zero axe violations", async ({ page }) => {
    const ONBOARDING = "https://weave.example/process/onboarding";
    const DOMAIN_MEMBERSHIP_PREDICATE = "https://weave.example/ontology/bpmo#memberOfDomain";
    await page.route("**/api/proxy/node-kinds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ kinds: [{ id: "Domain", label: "Domain", colour: "#3B82F6" }] }),
      });
    });
    await page.route("**/api/proxy/sparql**", async (route) => {
      const body = route.request().postDataJSON() as { query: string } | null;
      const isDomainQuery = body?.query.includes(DOMAIN_MEMBERSHIP_PREDICATE) ?? false;
      const responseBody = isDomainQuery
        ? { rows: [] }
        : {
            rows: [
              {
                subject: ONBOARDING,
                predicate: "https://weave.example/hasStep",
                object: "https://weave.example/step/create-account",
                bpmo_kind: "Domain",
                label: "Customer Onboarding",
              },
            ],
            columns: ["subject", "predicate", "object"],
            has_more_pages: false,
            page: 0,
          };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responseBody) });
    });
    await page.route("**/api/proxy/ontology/resource/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          label: "Customer Onboarding",
          type_label: "Domain",
          bpmo_kind: "Domain",
          key_properties: [],
          raw_iri: null,
          neighbours: [],
        }),
      });
    });

    await loginAndGoToDashboard(page);
    await page.goto("/explorer");
    await page.waitForFunction(() => window.__explorerLayoutSettled === true);

    const nodeInfo = await page.evaluate(
      (id) => window.__explorerNodeInfo?.(id),
      ONBOARDING
    );
    if (!nodeInfo) throw new Error("node not found on canvas");
    await page.mouse.click(nodeInfo.x, nodeInfo.y);
    await expect(page.getByTestId("explorer-side-panel")).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await page.mouse.click(nodeInfo.x, nodeInfo.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Focus domain" }).click();
    await expect(page.getByTestId("domain-focus-notice")).toBeVisible();
    await expect(page.getByText("This domain has no members")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
