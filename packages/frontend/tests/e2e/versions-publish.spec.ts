import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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
