import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// NOTE: authored against the real (unmocked) backend, same convention as
// project-settings.spec.ts / versions-publish.spec.ts -- requires the live
// dev stack (docker-compose + `make migrate`/`make seed`) with the demo
// tenant (acme-corp: admin@weave.local, seed_demo.py). Runs at epic-close
// ui_verify, not in this pass (no live stack here).

const PROCESS_KIND = "Process";

// ProcessShape (framework.shacl.ttl) requires performedBy -> Actor.
function processWithActorOps(label: string) {
  return [
    { op: "add_node", ref: "p1", kind: PROCESS_KIND, label },
    { op: "add_node", ref: "a1", kind: "Actor", label: "E2E Pin-Upgrade Actor" },
    { op: "add_edge", subject_ref: "p1", predicate: "performedBy", object_ref: "a1" },
  ];
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/build");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill("admin@weave.local");
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/build$/);
}

async function createProject(page: Page): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(`E2E pin-upgrade test ${Date.now()}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/build\/projects\/.+\/settings$/);
  const projectId = /\/build\/projects\/([^/]+)\/settings$/.exec(page.url())?.[1];
  if (!projectId) throw new Error("project id missing from post-create redirect");
  return decodeURIComponent(projectId);
}

async function publishNewOntologyVersion(page: Page, label: string): Promise<string> {
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: processWithActorOps(label) },
  });
  expect(apply.ok()).toBe(true);
  const { version_iri: draftVersionIri } = (await apply.json()) as { version_iri: string };

  const publish = await page.request.post(
    `/api/proxy/ontology/versions/${encodeURIComponent(draftVersionIri)}/publish`,
    { data: {} }
  );
  expect(publish.ok()).toBe(true);
  return draftVersionIri;
}

// TASK-016 AC-1/AC-4, Law B: confirming the pin upgrade actually moves the
// project's pinned ontology version in the backend -- proven via an
// independent GET (not the page's own fetch) after confirming.
test("reviewing and confirming a pin upgrade moves the backend pin (Law B)", async ({ page }) => {
  await loginAsAdmin(page);
  const projectId = await createProject(page);

  const before = await page.request.get(`/api/build/projects/${projectId}`);
  const { pinned_graph_version_iri: originalPin } = (await before.json()) as {
    pinned_graph_version_iri: string;
  };

  const newVersionIri = await publishNewOntologyVersion(page, `E2E Pin Upgrade ${Date.now()}`);

  await page.reload();
  await page.getByRole("button", { name: "Review upgrade" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Added")).toBeVisible();

  await page.getByRole("button", { name: "Confirm upgrade" }).click();
  await expect(page.getByRole("status")).toContainText(/upgraded/i);

  const after = await page.request.get(`/api/build/projects/${projectId}`);
  const { pinned_graph_version_iri: newPin } = (await after.json()) as {
    pinned_graph_version_iri: string;
  };
  expect(newPin).toBe(newVersionIri);
  expect(newPin).not.toBe(originalPin);
});

// TASK-016 AC-6, Law B: the trigger is hidden for a non-admin, and the
// server 403s a forced POST to pin-upgrade even bypassing the hidden UI.
test("should deny pin upgrade to a non-admin end to end", async ({ page, browser }) => {
  await loginAsAdmin(page);
  const projectId = await createProject(page);

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto("/build");
  await clientPage.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(
    clientPage.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })
  ).toBeVisible();
  await clientPage.getByLabel("Email").fill("client@weave.local");
  await clientPage.getByLabel("Tenant").fill("acme-corp");
  await clientPage.getByRole("button", { name: "Sign in" }).click();
  await clientPage.goto(`/build/projects/${encodeURIComponent(projectId)}/settings`);

  await expect(clientPage.getByRole("button", { name: "Review upgrade" })).toHaveCount(0);

  const forced = await clientPage.request.post(
    `/api/build/projects/${encodeURIComponent(projectId)}/pin-upgrade`,
    { data: { confirm_version_iri: "urn:weave:version:does-not-matter" } }
  );
  expect(forced.status()).toBe(403);

  await clientContext.close();
});
