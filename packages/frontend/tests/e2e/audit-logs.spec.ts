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
// the table has rows, expanding one exposes the signed entry (hash et al),
// and on-demand verification reports the chain valid.
test("audit logs table renders seeded rows, expands to signed JSON, verifies chain", async ({
  page,
}) => {
  await loginAndGoToAuditLogs(page);

  const rows = page.locator('[data-testid^="log-row-"]');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);

  await rows.first().click();
  await expect(page.locator('[data-testid^="log-detail-"]')).toContainText('"hash"');

  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByTestId("verify-result")).toContainText("valid");

  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
});
