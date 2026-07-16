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


// NOTE (coordinator): authored against the real (unmocked) backend -- not
// run in this pass, see engineer report. Requires the live dev stack
// (docker-compose) with the demo tenant seeded (seed_demo.py).

const PROCESS_KIND = "Process";

// ProcessShape (framework.shacl.ttl) requires performedBy -> an Actor, so a
// bare label-only Process is a SHACL violation -- every add_node here needs
// the Actor node + edge alongside it to produce a valid draft.
function processWithActorOps(label: string) {
  return [
    { op: "add_node", ref: "p1", kind: PROCESS_KIND, label },
    { op: "add_node", ref: "a1", kind: "Actor", label: "E2E Actor" },
    { op: "add_edge", subject_ref: "p1", predicate: "performedBy", object_ref: "a1" },
  ];
}

// The row (version-row.tsx) only ever renders `version.semver` (e.g.
// "0.1.3"), never the full version_iri URN -- so a row lookup has to match
// on the semver suffix, not the URN mint_version returns.
function semverOf(versionIri: string): string {
  return versionIri.split(":v").pop() ?? versionIri;
}

// Publishing requires the "publish" role rank (rbac.py); the seeded
// client@weave.local account is only "author" (seed_demo.py), one rank
// below -- only the seeded admin can actually publish, so that's who logs
// in here despite the name of the demo account not saying so.
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/ce/versions");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill("admin@weave.local");
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce\/versions$/);
  await dismissOnboarding(page);
}

// Law B: create a real draft against the live backend (not a route mock),
// then prove the Publish click actually changed backend state -- not just
// the DOM -- via a second, independent GET after the click.
test("create a draft, publish it, and see it land in the version list and Explore (Law B)", async ({ page }) => {
  await loginAsAdmin(page);

  const label = `E2E Onboarding ${Date.now()}`;
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: processWithActorOps(label) },
  });
  expect(apply.ok()).toBe(true);
  const { version_iri: draftVersionIri, ref_map } = (await apply.json()) as {
    version_iri: string;
    ref_map: Record<string, string>;
  };

  await page.reload();
  await page.waitForLoadState("networkidle");

  const draftRow = page
    .getByTestId("version-list")
    .getByRole("listitem")
    .filter({ hasText: semverOf(draftVersionIri) });
  await expect(draftRow).toBeVisible();
  await expect(draftRow.getByText("Draft")).toBeVisible();

  await draftRow.getByRole("button", { name: "Publish" }).click();
  await expect(draftRow.getByText("Published")).toBeVisible();

  // Backend-state proof #1: the version itself is published, independent
  // of what the UI now shows.
  const versions = await page.request.get("/api/proxy/ontology/versions?page=1&per_page=50");
  const { versions: versionList } = (await versions.json()) as {
    versions: { version_iri: string; status: string }[];
  };
  const published = versionList.find((entry) => entry.version_iri === draftVersionIri);
  expect(published?.status).toBe("published");

  // Backend-state proof #2: the entity created in the draft is now visible
  // in the published graph (Explore's own read path).
  const sparql = await page.request.get("/api/proxy/sparql?version=latest&page=0");
  const { rows } = (await sparql.json()) as { rows: { subject?: string }[] };
  expect(rows.some((row) => row.subject === ref_map.p1)).toBe(true);
});

// AC/degrade path: reviewing a draft's changes before publishing.
test("Review changes on a draft shows its diff against the published baseline", async ({ page }) => {
  await loginAsAdmin(page);

  const label = `E2E Review ${Date.now()}`;
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: processWithActorOps(label) },
  });
  const { version_iri: draftVersionIri } = (await apply.json()) as { version_iri: string };

  await page.reload();
  await page.waitForLoadState("networkidle");

  const draftRow = page
    .getByTestId("version-list")
    .getByRole("listitem")
    .filter({ hasText: semverOf(draftVersionIri) });
  await draftRow.getByRole("button", { name: "Review changes" }).click();

  await expect(draftRow.getByTestId("diff-view").or(draftRow.getByText(/no published baseline/i))).toBeVisible();
});

// Scenario 3 + additional inferred test (EPIC-009 epic-level AC,
// `weave-platform.md`): publishing is a real mutating action, so it must be
// findable by filtering /audit/logs (actor), and the export must actually
// contain that entry with its chain-integrity fields -- not just render a
// button (audit-logs.spec.ts's existing export test only checks visibility).
// KNOWN-BLOCKED (new finding, live-environment bug, not chased further here): this
// depends on the created draft appearing in `/ce/versions`' list after a
// reload, which is currently broken -- even the pre-existing, untouched
// "create a draft, publish it..." test above (unmocked, no @behavioural tag)
// fails the same way 100% of 3 attempts: apply() succeeds and the version
// counter keeps incrementing run over run, but the reloaded page renders
// "No versions yet." Looks like an active-workspace resolution problem
// (`get_active_workspace` / Redis session, `tenancy/sessions.py`) rather than
// a versions-list bug specifically -- other teammates are mid-fix on
// workspace/session issues in this same stack (idle-session bounce, 500s on
// workspace endpoints). Re-verify once those land; root-cause not chased
// further here (out of scope for a test-authoring pass on a live-contended stack).
test.fixme("publishing writes an audit entry findable by actor filter, and the export contains it with chain fields @behavioural", async ({
  page,
}) => {
  await loginAsAdmin(page);

  const label = `E2E Audit Trail ${Date.now()}`;
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: processWithActorOps(label) },
  });
  const { version_iri: draftVersionIri } = (await apply.json()) as { version_iri: string };

  await page.reload();
  await page.waitForLoadState("networkidle");
  const draftRow = page
    .getByTestId("version-list")
    .getByRole("listitem")
    .filter({ hasText: semverOf(draftVersionIri) });
  await draftRow.getByRole("button", { name: "Publish" }).click();
  await expect(draftRow.getByText("Published")).toBeVisible();

  await page.goto("/audit/logs");
  await page.getByLabel("Actor").fill("urn:weave:principal:user:admin");
  await page.getByRole("button", { name: "Filter" }).click();

  const publishedRow = page.locator('[data-testid^="log-row-"]', {
    hasText: "ontology.version.published",
  });
  await expect(publishedRow.first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON" }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream ?? []) chunks.push(chunk as Buffer);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
    event_type: string;
    hash: string;
    prev_hash: string;
    signature: string;
  }[];
  const exportedEntry = exported.find((e) => e.event_type === "ontology.version.published");
  expect(exportedEntry, "export should include the entry just filtered for").toBeTruthy();
  expect(exportedEntry?.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(exportedEntry?.signature).toBeTruthy();
});

// Scenario 6 + additional inferred test (EPIC-006 E6-S1, `weave-platform.md`):
// publishing notifies every OTHER active member (not the publisher) in real
// time -- proven with the seeded second user, not a mocked /api/notifications
// response (notifications.spec.ts's existing test is fully mocked). "Mark all
// read" then clears that recipient's badge.
// KNOWN-BLOCKED: same root cause as the audit-trail test above -- the draft never
// shows up in the version list to publish, so the Publish click never
// happens. See that test's comment.
test.fixme("publishing notifies the other active member, and mark-all-read clears their badge @behavioural", async ({
  page,
  browser,
}) => {
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto("/dashboard");
  await clientPage.getByRole("button", { name: "Sign in with Weave" }).click();
  await clientPage.getByLabel("Email").fill("client@weave.local");
  await clientPage.getByLabel("Tenant").fill("acme-corp");
  await clientPage.getByRole("button", { name: "Sign in" }).click();
  await expect(clientPage).toHaveURL(/\/dashboard$/);
  await dismissOnboarding(clientPage);

  await loginAsAdmin(page);
  const label = `E2E Notify ${Date.now()}`;
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: processWithActorOps(label) },
  });
  const { version_iri: draftVersionIri } = (await apply.json()) as { version_iri: string };
  await page.reload();
  await page.waitForLoadState("networkidle");
  const draftRow = page
    .getByTestId("version-list")
    .getByRole("listitem")
    .filter({ hasText: semverOf(draftVersionIri) });
  await draftRow.getByRole("button", { name: "Publish" }).click();
  await expect(draftRow.getByText("Published")).toBeVisible();

  await clientPage.reload();
  const trigger = clientPage.getByRole("button", { name: "Notifications" });
  await trigger.click();
  const panel = clientPage.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("ontology.version.published")).toBeVisible();

  const markAll = panel.getByRole("button", { name: /mark all read/i });
  await markAll.click();
  const badgeAfter = await trigger
    .locator("text=/^[0-9]+$/")
    .count()
    .catch(() => 0);
  expect(badgeAfter).toBe(0);

  await clientContext.close();
});
