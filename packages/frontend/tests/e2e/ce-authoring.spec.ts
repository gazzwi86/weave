import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// ONB-TASK-008: a first-visit-per-area welcome modal (WELCOME_MODALS,
// shared/onboarding/content/modals.ts) now fires on real logins against the
// seeded stack. Every CTA dismisses it (constitution/explorer/role-home also
// start a driver.js tour, which this then skips) -- a real user would click
// through it too, so tests must, or every later selector on the page times
// out behind its overlay.
async function dismissOnboarding(page: Page): Promise<void> {
  const welcome = page.getByRole("dialog").filter({ hasText: /welcome/i });
  try {
    await welcome.waitFor({ state: "visible", timeout: 3000 });
    await welcome.getByRole("button").last().click();
  } catch {
    // no welcome modal for this area/session.
  }
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  try {
    await skipTour.waitFor({ state: "visible", timeout: 2000 });
    await skipTour.click();
  } catch {
    // no tour started (non-tour-CTA area, or already seen).
  }
}


// TASK-006: mirrors auth.spec.ts's flow against the mock OIDC provider, but
// lands on /ce (return_to survives the round trip -- proven by auth.spec.ts).
async function loginAndGoToCe(page: Page): Promise<void> {
  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce$/);
  await dismissOnboarding(page);
  // Cold Next.js dev compile can lag behind first paint; without this, an
  // early click on the "Send" submit button races React's hydration and
  // falls back to a native form GET (seen as a spurious "/ce?" navigation).
  await page.waitForLoadState("networkidle");
}

const PROCESS_KIND = {
  iri: "urn:weave:kind:Process",
  label: "Process",
  properties: [
    {
      path: "urn:weave:prop:owner",
      name: "Owner",
      is_relationship: false,
      min_count: 1,
      max_count: 1,
      severity: "Violation",
    },
  ],
};

async function routeKinds(page: Page): Promise<void> {
  await page.route("**/api/ontology/types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ kinds: [PROCESS_KIND], relationships: [] }),
    });
  });
}

test.describe("CE authoring surfaces", () => {
  // AC-006-02/-03: NL prompt -> propose -> confirm -> CE-WRITE-1 -> IRI in chat.
  test("types 'add a Process called Customer Onboarding', confirms, sees the entity (AC-006-02/-03) @behavioural", async ({
    page,
  }) => {
    type ApplyBody = { operations: { op: string; label?: string }[] };
    // ponytail: an object wrapper, not a bare `let`, sidesteps a TS
    // control-flow quirk where a `let` reassigned only inside a callback
    // narrows to `never` at the read site.
    const captured: { applyBody: ApplyBody | null } = { applyBody: null };

    await page.route("**/api/ontology/authoring/nl", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          operations: [{ op: "add_node", ref: "p1", kind: PROCESS_KIND.iri, label: "Customer Onboarding" }],
        }),
      });
    });
    await page.route("**/api/operations/apply", async (route) => {
      captured.applyBody = route.request().postDataJSON() as ApplyBody;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          activity_iri: "urn:a1",
          applied_count: 1,
          version_iri: "urn:v1",
          ref_map: { p1: "urn:weave:process:1" },
        }),
      });
    });

    await loginAndGoToCe(page);
    await page.getByLabel(/message/i).fill("add a Process called Customer Onboarding");
    await page.getByRole("button", { name: "Send" }).click();

    await page.getByRole("button", { name: "Confirm" }).click();

    const entityLink = page.getByRole("link", { name: /urn:weave:process:1/ });
    await expect(entityLink).toBeVisible();
    await expect(entityLink).toHaveAttribute("href", "/explorer?focus=urn%3Aweave%3Aprocess%3A1");
    // Backend-state proof (Law 16): the exact mutation the UI dispatched.
    expect(captured.applyBody?.operations).toEqual([
      { op: "add_node", ref: "p1", kind: PROCESS_KIND.iri, label: "Customer Onboarding" },
    ]);

    // AC-006-05/DoD: chat history survives a real page reload (localStorage).
    await page.reload();
    await expect(page.getByRole("link", { name: /urn:weave:process:1/ })).toBeVisible();
  });

  // AC-006-04: "undo" proposes the inverse batch; confirming it removes the entity.
  test("says 'undo', confirms the inverse batch, entity is removed (AC-006-04)", async ({ page }) => {
    let lastApplyBody: { operations: { op: string; iri?: string }[] } | null = null;

    await page.route("**/api/ontology/authoring/nl", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          operations: [{ op: "add_node", ref: "p1", kind: PROCESS_KIND.iri, label: "Customer Onboarding" }],
        }),
      });
    });
    await page.route("**/api/operations/apply", async (route) => {
      lastApplyBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          activity_iri: "urn:a1",
          applied_count: 1,
          version_iri: "urn:v1",
          ref_map: { p1: "urn:weave:process:1" },
        }),
      });
    });

    await loginAndGoToCe(page);
    await page.getByLabel(/message/i).fill("add a Process called Customer Onboarding");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("link", { name: /urn:weave:process:1/ })).toBeVisible();

    await page.getByLabel(/message/i).fill("undo");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect
      .poll(() => lastApplyBody?.operations)
      .toEqual([{ op: "delete_node", iri: "urn:weave:process:1" }]);
  });

  // AC-006-07: guided form fields are a live projection of the kind's SHACL shape.
  test("opens the guided form for Process, fields match its SHACL shape (AC-006-07)", async ({ page }) => {
    await routeKinds(page);
    await loginAndGoToCe(page);

    await page.getByRole("combobox", { name: /add entity/i }).selectOption(PROCESS_KIND.iri);

    await expect(page.getByLabel(/^label/i)).toBeVisible();
    await expect(page.getByLabel(/owner/i)).toBeVisible();
  });

  // AC-006-08: empty required field blocks submit and highlights the field.
  test("submits the form with an empty required field -- highlighted, no commit (AC-006-08)", async ({ page }) => {
    let applyCalled = false;
    await routeKinds(page);
    await page.route("**/api/operations/apply", async (route) => {
      applyCalled = true;
      await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });

    await loginAndGoToCe(page);
    await page.getByRole("combobox", { name: /add entity/i }).selectOption(PROCESS_KIND.iri);
    await page.getByLabel(/^label/i).fill("Customer Onboarding");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(/owner is required/i)).toBeVisible();
    await expect(page.getByLabel(/owner/i)).toHaveAttribute("aria-invalid", "true");
    expect(applyCalled).toBe(false);
  });

  // DoD: "SHACL-driven form tested with all BPMO kinds". GuidedForm has zero
  // per-kind branching (every field comes from `shape.properties`), so this
  // hits the real, unmocked CE-READ-1 catalogue and opens the form for every
  // live kind -- proving the projection never crashes, for any kind, without
  // hand-listing all 13/14 in the test.
  test("opens the guided form for every live BPMO kind without error", async ({ page }) => {
    await loginAndGoToCe(page);
    const kindLabels = await page
      .getByRole("combobox", { name: /add entity/i })
      .locator("option")
      .allTextContents();
    const realKinds = kindLabels.filter((label) => label !== "Select a kind…");
    expect(realKinds.length).toBeGreaterThan(0);

    // GuidedForm unmounts the selector while open (only "Close", after a
    // successful submit, brings it back) -- a fresh page load per kind is
    // simpler than adding a cancel-without-submitting path for this test.
    for (const label of realKinds) {
      await page.goto("/ce");
      await page.getByRole("combobox", { name: /add entity/i }).selectOption({ label });
      await expect(page.getByLabel(/^label/i)).toBeVisible();
    }
  });
});
