import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors audit-dashboard.spec.ts's login flow against the mock OIDC provider.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const WIDGETS_RESPONSE = {
  widgets: [
    {
      id: "w-1",
      scope: "tenant_default",
      spec: {
        component_type: "kpi_card",
        title: "Entities in model",
        data_source_contracts: ["CE-METRICS-1"],
        bindings: { field: "entity_count_by_kind", aggregate: "sum" },
        column_span: 3,
      },
      position: 0,
      last_result: 128,
      fetched_at: "2026-07-10T12:00:00Z",
      status: "fresh",
      pending_fields: [],
      suggested: false,
    },
    {
      id: "w-2",
      scope: "tenant_default",
      spec: {
        component_type: "bar_chart",
        title: "SHACL errors by severity",
        data_source_contracts: ["CE-METRICS-1"],
        bindings: { field: "shacl_errors_by_severity" },
        column_span: 6,
      },
      position: 4,
      last_result: { pending: true },
      fetched_at: null,
      status: "pending",
      pending_fields: ["shacl_errors_by_severity"],
      suggested: false,
    },
  ],
};

// PLAT-V1-TASK-010 AC-2/AC-3/AC-5: sign in, land on /dashboard, see the
// fixed CE-sourced default dashboard's tiles -- a real number for a fresh
// widget, and "Counts pending" (never a literal 0) for a pending one.
test("fixed default dashboard renders CE-METRICS-1-sourced tiles", async ({ page }) => {
  await page.route("**/api/dashboard/widgets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(WIDGETS_RESPONSE),
    });
  });

  await loginAndGoToDashboard(page);

  await expect(page.getByText("Entities in model")).toBeVisible();
  await expect(page.getByTestId("widget-tile-w-1")).toContainText("128");

  await expect(page.getByText("SHACL errors by severity")).toBeVisible();
  await expect(page.getByTestId("widget-tile-w-2")).toContainText("Counts pending");
  await expect(page.getByTestId("widget-tile-w-2")).not.toContainText("0");

  await expect(page.getByText("CE-METRICS-1").first()).toBeVisible();
});
