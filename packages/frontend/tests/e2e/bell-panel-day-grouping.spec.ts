import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// AC-4: day-grouped bell panel, deep-linking to target_iri, mark-read.
// test_bell_panel_day_grouped_deep_links_mark_read
test("bell panel groups by day, deep-links a row's target, and marks it read", async ({ page }) => {
  let read = false;
  await page.route("**/api/notifications**", async (route) => {
    if (route.request().method() === "POST") {
      read = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "n-today", read: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [
          {
            id: "n-today",
            event_type: "job.completed",
            payload: {},
            delivered_channels: ["in_app"],
            read,
            created_at: new Date().toISOString(),
            target_iri: "urn:weave:entity:acme",
          },
          {
            id: "n-yesterday",
            event_type: "job.completed",
            payload: {},
            delivered_channels: ["in_app"],
            read: true,
            created_at: new Date(Date.now() - 86_400_000).toISOString(),
          },
        ],
        total: 2,
        page: 1,
        per_page: 25,
      }),
    });
  });

  await loginAndGoToDashboard(page);

  await page.getByRole("button", { name: "Notifications" }).click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("Today")).toBeVisible();
  await expect(panel.getByText("Yesterday")).toBeVisible();

  // AC-4 deep-link: the unread row's target_iri resolves via CE-READ-1's
  // resource route.
  await expect(panel.getByRole("link", { name: "job.completed" })).toHaveAttribute(
    "href",
    /\/ce\/resource\?iri=urn%3Aweave%3Aentity%3Aacme/
  );

  await panel.getByRole("button", { name: "Mark read" }).click();
  await expect(panel.getByRole("button", { name: "Mark read" })).toHaveCount(0);
});
