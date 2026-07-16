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


// Behavioural certification suite: each test asserts backend state changed
// (API/DB), not just UI (Law B). Resilience rule: navigate by URL, select by
// role/label/testid only -- never by nav-chrome position (the shell is being
// rebuilt in a parallel lane).

async function loginAs(
  page: Page,
  path: string,
  options?: { email?: string; tenantId?: string }
): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  if (options?.email) await page.getByLabel("Email").fill(options.email);
  if (options?.tenantId) await page.getByLabel("Tenant").fill(options.tenantId);
  await page.getByRole("button", { name: "Sign in" }).click();
  await dismissOnboarding(page);
}

type ApplyBody = { ref_map?: Record<string, string>; version_iri?: string };

function waitForApply(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes("/api/operations/apply") && res.request().method() === "POST"
  );
}

// GuidedForm has zero per-kind branching (ce-authoring.spec.ts), so Label is
// the only property every kind is guaranteed to require; a second pass fills
// any other field the form flags invalid (e.g. Process's Owner) generically,
// rather than hand-listing each kind's extra required fields. Reads the
// created IRI and version_iri straight off the real `/api/operations/apply`
// response (not the post-save "View in graph" link's href) -- the link is
// only a UI affordance and doesn't carry version_iri at all.
async function fillAndSaveGuidedForm(page: Page, label: string): Promise<{ iri: string; versionIri: string }> {
  await page.getByLabel(/^label/i).fill(label);
  let [response] = await Promise.all([waitForApply(page), page.getByRole("button", { name: "Save" }).click()]);

  const invalidFields = page.locator('[aria-invalid="true"]');
  const invalidCount = await invalidFields.count();
  if (invalidCount > 0) {
    for (let i = 0; i < invalidCount; i += 1) {
      await invalidFields.nth(i).fill(label);
    }
    [response] = await Promise.all([waitForApply(page), page.getByRole("button", { name: "Save" }).click()]);
  }

  const body = (await response.json()) as ApplyBody;
  const iri = body.ref_map?.form1;
  if (!iri) throw new Error(`apply response missing ref_map.form1: ${JSON.stringify(body)}`);
  if (!body.version_iri) throw new Error(`apply response missing version_iri: ${JSON.stringify(body)}`);
  return { iri, versionIri: body.version_iri };
}

// Scenario 1 (forms half) + scenario 2: create one instance of each of five
// BPMO kinds (Class covers "a class"; the other four are domains/systems/
// capabilities/service-catalog items) via the same generic guided form, then
// verify each via CE-READ-1 (GET /api/ontology/resource/{iri}) -- not just
// that the UI shows a success link. Self-cleaning: each entity is deleted via
// the real CE-WRITE-1 endpoint immediately after its check (same mechanism
// ce-authoring.spec.ts's "undo" test proves), so repeat runs don't leak rows.
// Real (unmocked) kind IRIs are `https://weave.io/ontology/<Kind>`
// (ontology/catalogue.py's `WEAVE` namespace + BPMO_KINDS local name) --
// NOT the `urn:weave:kind:X` scheme used elsewhere in this suite, which only
// ever appears alongside a mocked `/api/ontology/types` route (ce-authoring/
// ce-instance-browser specs). These tests hit the live catalogue, so the
// <select>'s real option value must be used or selectOption times out.
const KIND_NS = "https://weave.io/ontology/";

// KNOWN-BLOCKED (new finding, live product bug, not chased further -- out of scope
// for a test-authoring pass): `GET /api/proxy/ontology/resource/{iri}`
// crashes on every real read. Its frontend proxy route
// (app/api/proxy/ontology/resource/[iri]/route.ts's `CeResourceBody`
// interface + `stripLangTags`) expects `type_label` / `key_properties` /
// `neighbours` fields, but the real backend's `ResourceResponse`
// (schemas/ontology.py:107-119) only ever returns `kind` / `triples` /
// `outgoing` / `incoming` -- there's no `type_label` field at all, so
// `stripLangTag(body.type_label)` throws on `undefined.replace(...)` for
// every single real resource, not just these new ones. Confirmed via a
// sibling worktree's independent fix attempt (same route, "Known issue
// (intermittent 500/empty-body)" comment) that catches the crash but only
// degrades it to a 503 -- doesn't fix the shape mismatch, so the read still
// never succeeds either way. Grepping the whole frontend app turns up zero
// callers of this route outside its own tests, so it looks like dead code
// from before a backend schema refactor, first ever exercised end-to-end by
// this test. Un-skip once the proxy route is updated to the real
// ResourceResponse shape.
test.fixme("creates a domain, system, capability, service, and class via the guided form and verifies each via CE-READ-1 @behavioural", async ({
  page,
}) => {
  const kinds = [
    { iri: `${KIND_NS}BusinessDomain`, label: "Behavioural QA Domain" },
    { iri: `${KIND_NS}System`, label: "Behavioural QA System" },
    { iri: `${KIND_NS}BusinessCapability`, label: "Behavioural QA Capability" },
    { iri: `${KIND_NS}Service`, label: "Behavioural QA Service" },
    { iri: `${KIND_NS}Class`, label: "Behavioural QA Class" },
  ];

  await loginAs(page, "/ce", { email: "admin@weave.local", tenantId: "acme-corp" });
  await page.waitForLoadState("networkidle");

  for (const kind of kinds) {
    await page.goto("/ce");
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: /add entity/i }).selectOption(kind.iri);
    const { iri, versionIri } = await fillAndSaveGuidedForm(page, kind.label);
    await expect(page.getByRole("link", { name: "View in graph" }).last()).toBeVisible();

    // CE-READ-1's `?version=latest` only ever resolves the newest
    // *published* version (versioning.py's resolve_version, by design --
    // AC-002-08), and the entity just created lives in a fresh draft. It
    // has to be published before an independent read can see it at all.
    const publish = await page.request.post(
      `/api/proxy/ontology/versions/${encodeURIComponent(versionIri)}/publish`
    );
    expect(publish.ok(), `publishing ${kind.label}'s draft`).toBe(true);

    const read = await page.request.get(`/api/proxy/ontology/resource/${encodeURIComponent(iri)}`);
    expect(read.ok(), `CE-READ-1 should see the ${kind.label} just created`).toBe(true);
    const body = JSON.stringify(await read.json());
    expect(body).toContain(kind.label);

    const cleanup = await page.request.post("/api/operations/apply", {
      data: { operations: [{ op: "delete_node", iri }] },
    });
    expect(cleanup.ok()).toBe(true);
  }
});

// Scenario 8 + additional inferred test (EPIC-004 board empty-state AC,
// `docs/specs/weave/engines/build-engine.md`): the Registry lists a project
// the moment it's created, FR-066's governance cascade has already pinned a
// CE version (no ungoverned window), and a project with zero tasks renders
// the documented empty-state, never a blank board.
test("new project appears in the Registry, pins a CE version at creation, and its board shows the empty-state @behavioural", async ({
  page,
}) => {
  await loginAs(page, "/build", { email: "admin@weave.local", tenantId: "acme-corp" });

  const name = `Behavioural QA Registry ${Date.now()}`;
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");

  // Registry list (scenario 8: "assert registry ... render"). Filter via the
  // page's own search box first -- repeat runs of this suite (and others)
  // leave prior projects in the shared demo tenant with no cleanup path, so
  // an unfiltered list can push the just-created row off whatever page/limit
  // the Registry renders by default.
  await page.goto("/build");
  await page.getByRole("textbox", { name: "Search projects" }).fill(name);
  await expect(page.getByRole("link", { name })).toBeVisible();

  // FR-066: governance resolved + a CE version pinned immediately, proven by
  // an independent read, not the redirect URL alone. `pinned_graph_version_iri`
  // lives on the plain project resource (routers/projects.py's
  // ProjectResponse) -- the `/settings` subpath is a narrower
  // ProjectSettingsResponse (model_tier/cost_cap only, no pin field).
  const project = await page.request.get(`/api/build/projects/${projectId}`);
  expect(project.ok()).toBe(true);
  const projectBody = (await project.json()) as { pinned_graph_version_iri?: string };
  expect(projectBody.pinned_graph_version_iri).toBeTruthy();

  // EPIC-004: a fresh project's board has zero tasks -> empty-state, never blank.
  await page.goto(`/build/projects/${projectId}/board`);
  await expect(page.getByTestId("board-empty-state")).toBeVisible();
  await expect(page.getByTestId("board-empty-state")).toContainText(/no tasks/i);
});

// Additional inferred test (EPIC-002 FR-060, `build-engine.md`): "all company
// users can read any project, and a company/domain admin can edit any
// project, its specs, and its backlog" -- distinct from an explicit
// per-project role grant (already covered by project-settings.spec.ts's
// "editor" 403 test). Client creates+owns a project via the Registry;
// admin, who was never granted a role on it, can still edit its settings.
// KNOWN-BLOCKED (new finding, not the workspace-create escalation): blocked by an
// environment gap, not a UI bug -- mock_oidc/tokens.py's `_claims()` never
// mints a `roles` claim (only sub/tenant_id/principal_iri/session_version),
// so `Principal.roles` is always `[]` and `has_admin_grant`'s tenant-wide
// overlay (rbac.py's `enforce_project_role`) can never fire against this
// seeded stack -- FR-060's "company admin edits any project" path is
// unreachable/untestable until mock-oidc mints a `scope: "tenant"` grant for
// admin@weave.local. Un-skip once that seeding lands.
test.fixme("a company admin can edit a project it has no explicit per-project role on (EPIC-002 FR-060) @behavioural", async ({
  page,
  browser,
}) => {
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await loginAs(clientPage, "/build", { email: "client@weave.local", tenantId: "acme-corp" });

  const name = `Behavioural QA Admin-Override ${Date.now()}`;
  await clientPage.getByRole("button", { name: "New project" }).click();
  await clientPage.getByLabel("Name").fill(name);
  await clientPage.getByRole("button", { name: "Create" }).click();
  await expect(clientPage).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(clientPage.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  await clientContext.close();

  await loginAs(page, "/build", { email: "admin@weave.local", tenantId: "acme-corp" });
  const patch = await page.request.patch(`/api/build/projects/${projectId}/settings`, {
    data: { model_tier: "premium" },
  });
  expect(patch.status(), "company admin should edit any project without an explicit grant").toBe(200);

  const settings = await page.request.get(`/api/build/projects/${projectId}/settings`);
  const body = (await settings.json()) as { model_tier: string };
  expect(body.model_tier).toBe("premium");
});

// Scenario 5, workspace-level: the author role sees the admin-only copy
// instead of the provisioning form, and forcing the underlying POST directly
// (bypassing the hidden UI) is rejected by the server itself, not just hidden
// client-side (same "UI hides, server enforces" pattern as
// project-settings.spec.ts's editor-403 test).
// KNOWN-BLOCKED: certification found a privilege-escalation hole -- any tenant user
// can POST /api/tenancy/workspaces directly (no role check), which
// auto-admins the creator and escalates to tenant-admin. A fix is in flight
// on branch fix/workspace-create-authz. This test asserts the CORRECT end
// state (403 for a non-admin); un-skip once that branch merges.
test.fixme("author cannot see the workspace-admin surface; the API 403s a forced create @behavioural", async ({
  page,
}) => {
  await loginAs(page, "/settings/workspaces", { email: "client@weave.local", tenantId: "acme-corp" });
  await expect(page.getByText(/available to workspace admins only/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create workspace" })).toHaveCount(0);

  const forced = await page.request.post("/api/tenancy/workspaces", {
    data: { slug: `should-fail-${Date.now()}`, display_name: "Should Fail" },
  });
  expect(forced.status()).toBe(403);
});

// Scenario 5, cross-tenant: mock-oidc mints a real (not vacuously-rejected)
// token for a different tenant, which the ontology proxy route must still
// refuse to resolve an acme-corp IRI for. A 401 here would only prove auth
// works, not isolation, so the assertion pins "not 200, not 401" rather than
// one specific status -- the intruder tenant is genuinely new/empty, so 404
// (not found in its own, empty graph) is as valid an isolation proof as 403.
// The probe is published (same reason as the 5-kind test above: `?version=
// latest` never resolves a draft) and read back as its own tenant FIRST --
// a same-tenant 200 is the control that proves the cross-tenant 404 below is
// real isolation, not just "nobody can see an unpublished draft anyway".
// KNOWN-BLOCKED: same root cause as the 5-kind CE-READ-1 test above -- the proxy
// route this test's control-read depends on crashes on every real resource
// (schema mismatch, see that test's comment), so the "acme-corp's own
// session should read its own published entity" control never succeeds
// either, and without that control the cross-tenant assertion below can't
// actually distinguish real isolation from "this route is broken for
// everyone regardless of tenant." Un-skip once the proxy route is fixed.
test.fixme("a different tenant's token cannot read acme-corp's ontology resource via the proxy @behavioural", async ({
  page,
  browser,
}) => {
  await loginAs(page, "/ce", { email: "admin@weave.local", tenantId: "acme-corp" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: /add entity/i }).selectOption(`${KIND_NS}Concept`);
  const { iri, versionIri } = await fillAndSaveGuidedForm(page, "Behavioural QA Cross-Tenant Probe");
  await expect(page.getByRole("link", { name: "View in graph" }).last()).toBeVisible();

  const publish = await page.request.post(
    `/api/proxy/ontology/versions/${encodeURIComponent(versionIri)}/publish`
  );
  expect(publish.ok(), "publishing the probe entity's draft").toBe(true);

  const controlRead = await page.request.get(`/api/proxy/ontology/resource/${encodeURIComponent(iri)}`);
  expect(controlRead.ok(), "acme-corp's own session should read its own published entity").toBe(true);

  const evilContext = await browser.newContext();
  const evilPage = await evilContext.newPage();
  await loginAs(evilPage, "/ce", { email: "intruder@evil-corp.example", tenantId: "evil-corp" });

  const crossTenantRead = await evilPage.request.get(
    `/api/proxy/ontology/resource/${encodeURIComponent(iri)}`
  );
  expect(crossTenantRead.status()).not.toBe(200);
  expect(crossTenantRead.status()).not.toBe(401);
  await evilContext.close();

  const cleanup = await page.request.post("/api/operations/apply", {
    data: { operations: [{ op: "delete_node", iri }] },
  });
  expect(cleanup.ok()).toBe(true);
});

// Additional inferred test (EPIC-006 E6-S2 failure AC, `weave-platform.md`):
// "a missing preference defaults to 'on' so no critical alert is silently
// muted." A brand-new principal (mock-oidc auto-provisions on first login,
// PLAT-TASK-003) has no preference rows and no workspace role yet, so per
// `notifications/defaults.py`'s role -> default matrix (transcribed from
// notifications-recommendation.md) they only get the role-less baseline --
// `model.version.published` ("all members") + `member.added` (fires about
// the recipient themselves) -- not every registered type; the rest are
// additive per-role (e.g. `model.change.mention` defaults on only for
// enterprise_architect/data_steward). Asserting "every type" was a
// misreading of the AC; this asserts the actual documented baseline.
test("a brand-new principal's notification preferences default the baseline types to in-app on (EPIC-006 E6-S2) @behavioural", async ({
  page,
}) => {
  const freshEmail = `qa-fresh-${Date.now()}@weave.local`;
  await loginAs(page, "/settings/notifications", { email: freshEmail, tenantId: "acme-corp" });
  await expect(page).toHaveURL(/\/settings\/notifications$/);

  const res = await page.request.get("/api/notifications/preferences");
  expect(res.ok()).toBe(true);
  const { types } = (await res.json()) as { types: { event_type: string; in_app_enabled: boolean }[] };
  expect(types.length).toBeGreaterThan(0);

  const BASELINE = new Set(["model.version.published", "member.added"]);
  for (const t of types) {
    expect(t.in_app_enabled, `${t.event_type} in-app default`).toBe(BASELINE.has(t.event_type));
  }
});
