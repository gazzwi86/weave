import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors dashboard-widgets.spec.ts/accessibility.spec.ts's login flow
// against the mock OIDC provider.
async function loginAndGoToRoleHome(page: Page): Promise<void> {
  await page.goto("/role-home");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/role-home$/);
}

// PLAT-V1-TASK-017 `test_role_home_viewer_vs_architect` (E2E, minimum 1):
// mock-OIDC issues no `roles` claim (documented gap, lib/auth/session-claims.ts),
// so the login flow can only exercise the default (Viewer/read) authority
// level in a real browser -- the publish-level view is covered by the
// backend's `test_role_matrix_capability_filtering` integration test via
// `app.dependency_overrides`, which the browser session can't reach.
test.describe("role-home (real browser)", () => {
  test("Viewer sees read capabilities and coming-soon cards, no author actions, zero axe violations", async ({
    page,
  }) => {
    // Law B: no `page.route` mock in this spec -- the page is a Next.js
    // Server Component that fetches `GET /api/role-home` from the real
    // uvicorn backend (playwright.config.ts's webServer), so every
    // assertion below is against real backend RBAC/CE-METRICS-1 state.
    await loginAndGoToRoleHome(page);

    // Viewer (read) content-table row: explore/view capabilities only --
    // no author-or-above capability id should render (AC-4).
    await expect(page.getByRole("heading", { name: "What can Weave do for you?" })).toBeVisible();
    await expect(page.getByTestId("next-action-banner")).toBeVisible();
    const authorOnlyIds = ["edit-nl", "pin-widgets", "publish-versions", "author-shapes"];
    for (const id of authorOnlyIds) {
      await expect(page.getByTestId(`capability-${id}`)).toHaveCount(0);
    }

    // AC-2: gated engines render coming-soon, never hidden.
    await expect(page.getByTestId("capability-build-generate")).toContainText("Coming soon");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
