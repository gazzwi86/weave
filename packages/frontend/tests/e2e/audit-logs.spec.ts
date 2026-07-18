import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts. The default mock
// OIDC user is admin@weave.local (super-admin), which the admin-only
// /api/audit endpoint requires.
async function loginAndGoToAuditLogs(page: Page): Promise<void> {
  await page.goto("/audit/logs");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/audit\/logs$/);
}

// Row-level viewer over the real, seeded hash-chained trail (no API mocks):
// the table has rows, expanding one exposes the signed entry (hash et al,
// via DataTable's own table-row-/table-row-detail- testids), and on-demand
// verification reports the chain valid via a toast (logs page.tsx's
// useVerifyResultToast -- there is no dedicated verify-result element).
test("audit logs table renders seeded rows, expands to signed detail, verifies chain", async ({
  page,
}) => {
  await loginAndGoToAuditLogs(page);

  const rows = page.locator('[data-testid^="table-row-"]');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);

  await rows.first().click();
  await expect(page.locator('[data-testid^="table-row-detail-"]')).toContainText("Entry hash");

  await page.getByRole("button", { name: "Verify chain" }).click();
  // Filter, not a bare role query: the practice-mode banner (app-shell.tsx)
  // is also role="status" once the demo user's sandbox fork completes, so a
  // bare getByRole("status") is a strict-mode violation waiting to happen.
  await expect(page.getByRole("status").filter({ hasText: /chain valid/i })).toBeVisible();

  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

// AC-5 must be a real filter, not decoration: filtering by a non-event_type
// dimension (Actor) has to actually narrow what's rendered, proven against a
// mocked /api/audit that only returns the actor-matching row when the
// request carries actor_principal_iri -- an unwired filter would keep
// returning the same unfiltered page regardless of what's typed.
test("filtering audit logs by actor (a non-event_type dimension) narrows the rendered rows", async ({
  page,
}) => {
  const ALL_ROWS = {
    entries: [
      {
        seq: 2,
        ts: "2026-07-05T00:00:02+00:00",
        actor_principal_iri: "urn:weave:principal:tenant-1:human:bob",
        engine: "platform",
        event_type: "workspace.created",
        target_iri: "urn:weave:workspace:tenant-1:ws-2",
        diff_summary: null,
        hash: "a".repeat(64),
        prev_hash: "0".repeat(64),
        signature: "b".repeat(128),
      },
      {
        seq: 1,
        ts: "2026-07-05T00:00:01+00:00",
        actor_principal_iri: "urn:weave:principal:tenant-1:human:alice",
        engine: "platform",
        event_type: "workspace.created",
        target_iri: "urn:weave:workspace:tenant-1:ws-1",
        diff_summary: null,
        hash: "c".repeat(64),
        prev_hash: "0".repeat(64),
        signature: "d".repeat(128),
      },
    ],
    total: 2,
    page: 1,
    per_page: 50,
  };

  await page.route("**/api/audit?**", async (route) => {
    const url = new URL(route.request().url());
    const actor = url.searchParams.get("actor_principal_iri");
    const body = actor
      ? { ...ALL_ROWS, entries: ALL_ROWS.entries.filter((e) => e.actor_principal_iri === actor), total: 1 }
      : ALL_ROWS;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await loginAndGoToAuditLogs(page);

  const rows = page.locator('[data-testid^="table-row-"]');
  await expect(rows).toHaveCount(2);

  await page.getByLabel("Actor").fill("urn:weave:principal:tenant-1:human:bob");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("table-row-2")).toBeVisible();
  await expect(page.getByTestId("table-row-1")).toHaveCount(0);
});
