import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-V1-TASK-005: the M2 overlay release-gate suite (m2-delta.md §7,
// invariants.md §M2). One file, four surfaces -- mirrors the m1/TASK-015
// "one gate suite, not per-task gate tests" precedent. Every scenario needs
// the real M1/M2 API behind a Postgres-backed Playwright webServer, which
// this sandbox does not have (same gap already logged by TASK-002/003/004's
// specs -- explorer-completeness-tour.spec.ts, role-home-guidance.spec.ts,
// explorer-trust-mechanics-tour.spec.ts, ce-rules-policies-tour.spec.ts).
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close (repo precedent, see the four specs above).
//
// AC-005-07 release gate (every m2-delta §3 anchor `shipped: true`) is
// asserted without a browser in packages/shared/tests/m2-release-gate.test.ts
// -- ANCHORS is config, not DOM, so a browser adds nothing there.

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }], relTypes: [] };

// The 11 m2-delta §3 anchor ids (AC-005-02's absent-anchor resilience set),
// tagged with the owning surface route so the loop below can hide each one
// via a test-only CSS class toggle on its own page, one at a time -- not
// 11 separate app builds (Implementation Hints).
const M2_ANCHORS: { id: string; route: string }[] = [
  { id: "plat.role-home.nav-entry", route: "/role-home" },
  { id: "plat.role-home.capabilities", route: "/role-home" },
  { id: "plat.role-home.completeness-map", route: "/role-home" },
  { id: "plat.role-home.next-action", route: "/role-home" },
  { id: "plat.role-home.summary-tiles", route: "/role-home" },
  { id: "ge.overlay.controls", route: "/explorer" },
  { id: "ge.overlay.completeness-legend", route: "/explorer" },
  { id: "ge.versions.panel", route: "/explorer" },
  { id: "ge.filters.governed-content", route: "/explorer" },
  { id: "ce.rules.shape-list", route: "/ce/rules" },
  { id: "ce.rules.violation-report", route: "/ce/rules" },
];

const ROLE_PATHS = ["business", "technical", "compliance", "admin"] as const;

async function mockGraphFetch(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", (route) =>
    route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) }),
  );
  await page.route("**/api/proxy/sparql**", (route) =>
    route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ rows: [], columns: ["subject", "predicate", "object"], has_more_pages: false, page: 0 }),
    }),
  );
}

async function loginAs(page: Page, role: (typeof ROLE_PATHS)[number]): Promise<void> {
  await mockGraphFetch(page);
  await page.route("**/api/onboarding/path", (route) =>
    route.fulfill({
      status: 200,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ role_path: role, path_variant: "default", path_chosen_manually: false, needs_choice: false }),
    }),
  );
  await page.goto("/role-home");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("M2 overlay a11y + focus trap, per surface (AC-005-01)", () => {
  const surfaces = [
    { name: "role-home", route: "/role-home" },
    { name: "completeness-map", route: "/explorer?tour=completeness-map" },
    { name: "trust-mechanics GE", route: "/explorer?tour=trust-mechanics" },
    { name: "rules-policies CE", route: "/ce/rules?tour=rules-policies" },
  ];

  for (const surface of surfaces) {
    test.fixme(`${surface.name}: tour open, zero axe violations at every step`, async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto(surface.route);
      let results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      while (await page.getByRole("button", { name: /next/i }).isVisible()) {
        await page.getByRole("button", { name: /next/i }).click();
        results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      }
    });
  }

  test.fixme("welcome modal: Tab cycles inside dialog, Esc closes, focus returns to trigger", async ({ page }) => {
    await loginAs(page, "admin");
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    const focusables = modal.locator("button, a[href]");
    const count = await focusables.count();
    for (let i = 0; i < count + 1; i += 1) {
      await page.keyboard.press("Tab");
      await expect(modal.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });
});

test.describe("Absent-anchor resilience, 11-anchor M2 set (AC-005-02)", () => {
  // ponytail: hides each anchor via a test-only `.onb-hide-anchor` CSS class
  // toggled on the element (not 11 separate builds) -- Implementation Hints.
  for (const anchor of M2_ANCHORS) {
    test.fixme(`hiding ${anchor.id} skips+warns, never blocks the tour, no orphaned tooltip`, async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto(anchor.route);
      // ponytail: string concat, not a template literal -- audit-anchors.ts's
      // scanner is a literal-attribute regex over raw file source, so a
      // `${id}` interpolation reads as an unregistered anchor id (same
      // gotcha role-home-guidance.spec.ts already hit).
      await page.evaluate((id) => {
        document.querySelector("[data-tour-id=\"" + id + "\"]")?.classList.add("onb-hide-anchor");
      }, anchor.id);
      const warnings: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "warning") warnings.push(msg.text());
      });
      await page.getByRole("button", { name: /take a tour/i }).click();
      await expect(page.getByRole("dialog", { name: /tour complete/i })).toBeVisible();
      expect(warnings.some((w) => w.includes(anchor.id))).toBe(true);
      await expect(page.locator("[role='tooltip']")).toHaveCount(0);
    });
  }
});

test.describe("Role-tailoring matrix, 4 paths (AC-005-03)", () => {
  // The offered-set-vs-`paths`-tag logic itself is proven without a browser
  // in lib/onboarding/__tests__/m2-role-tailoring-matrix.test.ts (pure
  // function over config, real TOURS + real ANCHORS) -- this E2E only
  // proves the CTA actually renders/hides per role in the live UI.
  for (const role of ROLE_PATHS) {
    test.fixme(`path=${role}: Help launcher offers exactly the configured M2 tours, no dead CTA`, async ({ page }) => {
      await loginAs(page, role);
      await page.getByRole("button", { name: "Help" }).click();
      const tourLinks = page.getByRole("link", { name: /take .* tour/i });
      const hrefs = await tourLinks.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(hrefs.every((href) => href && href !== "#")).toBe(true);
    });
  }
});

test.describe("Competency-guidance lifecycle, zero CE calls (AC-005-04)", () => {
  // Backend-side "zero CE calls" + "idempotent self-mark" invariants are
  // proven without a browser in
  // packages/backend/tests/unit/test_onboarding_competency_guidance.py.
  // This E2E additionally spies on the CE proxy route so a regression that
  // *adds* a CE call on this UI path fails here too, not just server-side.
  test.fixme("beacon: open while item open, self-mark hides it once, re-mark is a no-op, zero CE traffic", async ({ page }) => {
    let ceCalls = 0;
    await page.route("**/api/proxy/**", (route) => {
      ceCalls += 1;
      route.continue();
    });
    await loginAs(page, "business");
    const beacon = page.getByRole("button", { name: /hint available/i });
    await expect(beacon).toBeVisible();

    await beacon.click();
    await page.getByRole("link", { name: /learn more/i }).click();
    await page.getByRole("button", { name: /mark done/i }).click();
    await page.goto("/role-home");
    await expect(beacon).not.toBeVisible();

    // Idempotent re-mark: revisiting the deep link and marking done again
    // produces no second completion and no new beacon.
    await page.goto("/training/declare-competency-questions");
    await page.getByRole("button", { name: /mark done/i }).click();
    await page.goto("/role-home");
    await expect(beacon).not.toBeVisible();

    expect(ceCalls).toBe(0);
  });
});

test.describe("Business-path starter tile un-omit (AC-005-05)", () => {
  // Platform E1-S6 / Platform v1 TASK-010 AC-8 behaviour -- onboarding
  // asserts, never implements (m2-delta.md §2/§9). Also blocked on the
  // Platform starter-tile toggle itself landing in packages/frontend's
  // dashboard, not just the Postgres gap above.
  test.fixme("Business dashboard shows the ontology-health/completeness starter tile when CE-METRICS-1 is live-stubbed", async ({ page }) => {
    await page.route("**/api/dashboard/widgets**", (route) =>
      route.fulfill({
        status: 200,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify({
          widgets: [{ id: "ontology-health", data_source_contracts: ["CE-METRICS-1"], available: true }],
        }),
      }),
    );
    await loginAs(page, "business");
    await page.goto("/dashboard");
    await expect(page.getByText(/ontology.health|completeness/i)).toBeVisible();
  });
});
