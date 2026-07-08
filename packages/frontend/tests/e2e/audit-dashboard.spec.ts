import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as billing.spec.ts/compliance.spec.ts.
async function loginAndGoToAudit(page: Page): Promise<void> {
  await page.goto("/audit");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/audit$/);
}

// Same deterministic summary shape as compliance.spec.ts -- /audit reads the
// identical tenant-scoped `GET /api/audit/compliance` endpoint.
const COMPLIANCE_SUMMARY = {
  chain_status: "valid",
  entries_checked: 42,
  first_broken_seq: null,
  by_event_category: { workspace: 12, security: 3 },
  top_actors: [{ principal_iri: "urn:weave:principal:user:abc123", event_count: 45 }],
  period: "2026-07",
};

// Audit dashboard: sign in as admin, land on /audit, see the chain-status
// badge, the per-category event volumes, and the row-level drill-down link.
test("audit dashboard renders chain status, categories, and links to /audit/logs", async ({
  page,
}) => {
  await page.route("**/api/audit/compliance**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COMPLIANCE_SUMMARY),
    });
  });

  await loginAndGoToAudit(page);

  await expect(page.getByTestId("chain-status")).toContainText("valid");
  await expect(page.getByText("Events by category")).toBeVisible();
  await expect(page.getByTestId("event-category-list")).toContainText("workspace: 12");

  // Scoped to main -- the sidebar nav carries its own "View logs" link.
  await page.getByRole("main").getByRole("link", { name: "View logs" }).click();
  await expect(page).toHaveURL(/\/audit\/logs$/);
});
