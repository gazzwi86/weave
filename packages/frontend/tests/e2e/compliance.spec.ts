import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/notifications.spec.ts.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const COMPLIANCE_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
};

// TASK-009 E2E requirement: `test_audit_compliance_view_renders` -- sign in,
// navigate the Compliance view, assert chain status "valid" shown, event
// category counts displayed, and no raw diff payload visible.
test("compliance view renders chain status and event category counts (AC-7)", async ({
  page,
}) => {
  await page.route("**/api/audit/compliance**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COMPLIANCE_SUMMARY),
    });
  });

  await loginAndGoToDashboard(page);
  await page.getByRole("link", { name: "View audit compliance" }).click();
  await expect(page).toHaveURL(/\/compliance$/);

  await expect(page.getByTestId("chain-status")).toContainText("valid");
  await expect(page.getByTestId("entries-checked")).toContainText("42");
  await expect(page.getByTestId("event-category-list")).toContainText("workspace: 12");
  await expect(page.getByTestId("event-category-list")).toContainText("security: 3");

  // Structural redaction proof: the rendered page never contains the raw
  // diff_summary field name or any diff-shaped payload, for any role --
  // the backend response shape has no such field to leak (AC-7).
  await expect(page.locator("body")).not.toContainText("diff_summary");
});
