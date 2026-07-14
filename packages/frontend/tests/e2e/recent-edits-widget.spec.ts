import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors dashboard-widgets.spec.ts's login flow against the mock OIDC provider.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const RECENT_EDITS_WIDGET = {
  id: "w-recent-edits",
  scope: "user",
  spec: {
    component_type: "activity_feed",
    title: "Recent edits",
    data_source_contracts: ["CE-EVENT-1", "CE-READ-1"],
    bindings: { category: "collaboration-activity" },
    column_span: 6,
  },
  position: 0,
  last_result: {
    rows: [
      {
        actor: "alice@acme.com",
        entity_iri: "urn:acme:process:onboarding",
        label: "Onboarding process",
        href: "/resource/urn:acme:process:onboarding",
        version_iri: "urn:acme:version:7",
        created_at: "2026-07-12T09:00:00Z",
      },
      {
        actor: "bob@acme.com",
        entity_iri: "urn:acme:goal:grow",
        label: "Grow revenue",
        href: "/resource/urn:acme:goal:grow",
        version_iri: null,
        created_at: "2026-07-12T08:00:00Z",
      },
    ],
  },
  fetched_at: "2026-07-12T09:05:00Z",
  status: "fresh",
  pending_fields: [],
  suggested: false,
};

// PLAT-V1-TASK-024 AC-1/AC-2: sign in, land on /dashboard, and the recent-edits
// widget renders each committed row's actor + entity deep link + draft badge --
// asserting the widget-tile mount chain end to end, not just that the page loads.
test("recent-edits widget renders actor rows with deep links and a draft badge", async ({
  page,
}) => {
  await page.route("**/api/dashboard/widgets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ widgets: [RECENT_EDITS_WIDGET] }),
    });
  });

  await loginAndGoToDashboard(page);

  const tile = page.getByTestId("widget-tile-w-recent-edits");
  await expect(tile).toContainText("Recent edits");
  await expect(tile).toContainText("alice@acme.com");
  await expect(tile).toContainText("Onboarding process");
  await expect(tile.getByRole("link", { name: /onboarding process/i })).toHaveAttribute(
    "href",
    "/resource/urn:acme:process:onboarding"
  );
  await expect(tile).toContainText("Draft");
  await expect(tile).toContainText("CE-EVENT-1");
  await expect(tile).toContainText("CE-READ-1");
});

// AC-3: an aged-out cursor re-baseline never renders a blank feed -- the
// named-reason notice is visible instead.
test("recent-edits widget shows a re-baseline notice instead of a blank feed", async ({
  page,
}) => {
  await page.route("**/api/dashboard/widgets**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        widgets: [
          {
            ...RECENT_EDITS_WIDGET,
            last_result: { rows: [], truncated: true, notice: "Feed re-baselined" },
          },
        ],
      }),
    });
  });

  await loginAndGoToDashboard(page);

  const tile = page.getByTestId("widget-tile-w-recent-edits");
  await expect(tile).toContainText(/re-baselined/i);
});
