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


// NOTE (coordinator): authored against the real (unmocked) backend, same
// convention as versions-publish.spec.ts -- requires the live dev stack
// (docker-compose + `make migrate`/`make seed`) with the demo tenant
// (acme-corp: admin@weave.local / client@weave.local, seed_demo.py).

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
  await dismissOnboarding(page);
}

async function createProject(page: Page): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(`E2E settings test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return decodeURIComponent(projectId);
}

// TASK-015 AC-2/AC-4, Law B: the settings PATCH actually changes backend
// state (not just the DOM) -- proven via an independent GET after save.
// KNOWN-BLOCKED: blocked by a known, already-tracked limitation (QA ledger
// XT-BE013-1 / ADR-013): `settings/scope.py`'s IRI grammar cannot parse a
// real Build project IRI (`urn:weave:project:{tenant}:{slug}`), so
// `project_settings.py`'s PATCH always 503s ("Unable to save that change.")
// rather than persisting -- the router's own docstring says this is
// "tracked ... pending an ADR-013 fix". Un-skip once that lands.
test.fixme("saving a governance change persists to the backend (Law B) @behavioural", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.getByLabel("Model tier").selectOption("premium");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Backend-state proof: a fresh, independent read (not the page's own
  // fetch) shows the change actually persisted.
  const settings = await page.request.get(`/api/build/projects/${projectId}/settings`);
  expect(settings.ok()).toBe(true);
  const body = (await settings.json()) as { model_tier: string };
  expect(body.model_tier).toBe("premium");
});

// TASK-015 AC-4: a caller with no project-admin role sees the governance
// form read-only and cannot mutate it, even by direct URL visit.
test("a non-admin caller sees governance controls disabled", async ({ page, browser }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await loginAs(clientPage, "client@weave.local");
  await clientPage.goto(`/build/projects/${encodeURIComponent(projectId)}/settings`);

  await expect(clientPage.getByLabel("Model tier")).toBeVisible();
  await expect(clientPage.getByLabel("Model tier")).toBeDisabled();
  await expect(clientPage.getByRole("button", { name: "Save" })).toHaveCount(0);

  await clientContext.close();
});

// TASK-015 AC-4, Law B: the UI hiding the Save button is UX only -- the
// real boundary is the server. A non-admin forcing the PATCH directly
// (bypassing the disabled UI) must be rejected by the backend itself, and
// the settings must remain unchanged (independent GET as admin).
test("should deny settings mutation to editor end to end", async ({ page, browser }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await loginAs(clientPage, "client@weave.local");
  await clientPage.goto(`/build/projects/${encodeURIComponent(projectId)}/settings`);

  const forcedPatch = await clientPage.request.patch(
    `/api/build/projects/${encodeURIComponent(projectId)}/settings`,
    { data: { model_tier: "premium" } }
  );
  expect(forcedPatch.status()).toBe(403);

  // Backend-state proof: the forced write did not take -- an independent
  // read (admin session) still shows the original tier.
  const settings = await page.request.get(`/api/build/projects/${projectId}/settings`);
  const body = (await settings.json()) as { model_tier: string };
  expect(body.model_tier).not.toBe("premium");

  await clientContext.close();
});

// TASK-015 AC-5, Law B: add/remove contributor from the settings tab
// actually mutates the backend contributor list, proven via an
// independent GET (not the page's own fetch) before/after each action.
test("should manage contributors from settings tab", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);
  const contributorIri = "urn:weave:principal:user:client";

  await page.getByRole("tab", { name: "Contributors" }).click();
  await page.getByLabel("New contributor principal").fill(contributorIri);
  await page.getByRole("button", { name: "Add contributor" }).click();
  await expect(page.getByText(contributorIri)).toBeVisible();

  const afterAdd = await page.request.get(`/api/build/projects/${projectId}/contributors`);
  const addedBody = (await afterAdd.json()) as { items: { principal_iri: string }[] };
  expect(addedBody.items.some((c) => c.principal_iri === contributorIri)).toBe(true);

  await page
    .getByRole("row", { name: new RegExp(contributorIri) })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText(contributorIri)).toHaveCount(0);

  const afterRemove = await page.request.get(`/api/build/projects/${projectId}/contributors`);
  const removedBody = (await afterRemove.json()) as { items: { principal_iri: string }[] };
  expect(removedBody.items.some((c) => c.principal_iri === contributorIri)).toBe(false);
});

// TASK-022 (FR-010) AC-1/AC-3/AC-5, Law B: binding a Jira space from the
// Connections tab actually creates a row via the real backend, proven via
// an independent GET (not the page's own fetch) before/after bind and
// after remove. NOTE: requires the backend process to have
// `BUILD_CONNECTOR_STUB_INSTANCES` seeded with a `jira-1` instance
// (connectors/client.py's PLAT-CONNECTOR-1 stub seam) -- not yet wired
// into the dev-stack launch config, so this is Law-B-shaped but not
// runnable until that seeding lands (see TASK-022 receipt).
test("should bind jira board see health badge end end", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);

  await page.getByRole("tab", { name: "Connections" }).click();
  await page.getByRole("button", { name: "Bind Jira" }).click();
  await page.getByLabel(/connector instance/i).fill("jira-1");
  await page.getByLabel(/space/i).fill("ACME");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("OK")).toBeVisible();

  const afterBind = await page.request.get(`/api/build/projects/${projectId}/bindings`);
  const boundBody = (await afterBind.json()) as { items: { system: string; space_ref: string }[] };
  expect(boundBody.items.some((b) => b.system === "jira" && b.space_ref === "ACME")).toBe(true);

  await page.getByRole("button", { name: "Remove Jira binding" }).click();
  await page.getByRole("button", { name: "Confirm remove" }).click();
  await expect(page.getByText("ACME")).toHaveCount(0);

  const afterRemove = await page.request.get(`/api/build/projects/${projectId}/bindings`);
  const removedBody = (await afterRemove.json()) as { items: { system: string }[] };
  expect(removedBody.items.some((b) => b.system === "jira")).toBe(false);
});

// TASK-023 (E2-S6, FR-061/B9) AC-1, Law B: configuring source control
// actually persists provider + a secret *reference* to the backend, proven
// via an independent GET -- and the raw token value must never come back
// in that (or any) response body.
test("should configure source control and never echo the token end to end", async ({ page }) => {
  await loginAs(page, "admin@weave.local");
  const projectId = await createProject(page);
  const sentinelToken = `ghp_e2e-sentinel-${Date.now()}`;

  await page.getByRole("tab", { name: "Source control" }).click();
  await page.getByLabel(/provider/i).selectOption("github");
  await page.getByLabel(/token/i).fill(sentinelToken);
  await page.getByRole("button", { name: /configure|save/i }).click();
  await expect(page.getByText(/weave\/.+\/token/)).toBeVisible();

  // Backend-state proof: an independent GET returns the provider + a
  // secret reference, and the sentinel token string never appears in it.
  const settings = await page.request.get(`/api/build/projects/${projectId}/source-control`);
  expect(settings.ok()).toBe(true);
  const body = (await settings.json()) as { provider: string; token_secret_ref: string };
  expect(body.provider).toBe("github");
  expect(body.token_secret_ref).toBeTruthy();
  const responseText = JSON.stringify(body);
  expect(responseText).not.toContain(sentinelToken);
});
