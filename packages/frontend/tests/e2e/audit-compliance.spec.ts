import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/audit-dashboard.spec.ts/audit-logs.spec.ts.
async function loginAndGoToCompliance(page: Page): Promise<void> {
  await page.goto("/audit/compliance");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/audit\/compliance$/);
}

const COMPLIANCE_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
  shacl_validated: 30,
  shacl_rejections: 2,
};

// TASK-009 E2E requirement (refit): sign in, land on the canonical
// /audit/compliance route (AC-6), see the verdict band and the chain stat
// card, export evidence and get a toast, and never leak diff_summary.
test("compliance view renders the verdict band, chain stat card, and exports evidence", async ({
  page,
}) => {
  await page.route("**/api/audit/compliance**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COMPLIANCE_SUMMARY),
    });
  });

  await loginAndGoToCompliance(page);

  await expect(page.getByTestId("compliance-verdict")).toContainText("42");
  await expect(page.getByTestId("stat-chain")).toContainText("Valid");
  await expect(page.getByTestId("stat-policy-violations")).toContainText(/not available/i);
  await expect(page.getByTestId("attention-empty")).toBeVisible();

  await page.getByRole("button", { name: "Export evidence" }).click();
  // Filter, not a bare role query: the practice-mode banner (app-shell.tsx)
  // is also role="status" once the demo user's sandbox fork completes, so a
  // bare getByRole("status") is a strict-mode violation waiting to happen.
  await expect(page.getByRole("status").filter({ hasText: /evidence exported/i })).toBeVisible();

  // Structural redaction proof: the rendered page never contains the raw
  // diff_summary field name or any diff-shaped payload, for any role --
  // the backend response shape has no such field to leak (AC-7).
  await expect(page.locator("body")).not.toContainText("diff_summary");
});

// AC-6: test_legacy_compliance_route_redirects_and_nav_highlights_audit --
// the legacy /compliance URL 307-redirects to /audit/compliance, and the
// "Audit trail" nav rail item is highlighted once there.
test("test_legacy_compliance_route_redirects_and_nav_highlights_audit", async ({ page }) => {
  await page.route("**/api/audit/compliance**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COMPLIANCE_SUMMARY),
    });
  });

  await loginAndGoToCompliance(page);
  await page.goto("/compliance");

  await expect(page).toHaveURL(/\/audit\/compliance$/);
  await expect(page.getByRole("link", { name: "Audit trail" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});
