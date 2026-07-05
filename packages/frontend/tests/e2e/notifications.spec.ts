import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as global-search.spec.ts (only two files need it so far).
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// TASK-007 has no SSE/polling in M1 (use-notifications.ts fetches on mount
// and on panel-open only), so "a job completion event arrives" is simulated
// the same way the backend would surface it to this client: the next
// GET /api/notifications the badge/panel makes returns the new unread item.
test("notification appears in the centre, badge increments then decrements on read", async ({
  page,
}) => {
  let read = false;
  await page.route("**/api/notifications**", async (route) => {
    if (route.request().method() === "POST") {
      read = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "n-1", read: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [
          {
            id: "n-1",
            event_type: "job.completed",
            payload: { job_id: "job-1", result: "success" },
            delivered_channels: ["in_app"],
            read,
            created_at: "2026-07-04T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        per_page: 25,
      }),
    });
  });

  await loginAndGoToDashboard(page);

  const trigger = page.getByRole("button", { name: "Notifications" });
  await expect(trigger.getByText("1")).toBeVisible();

  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("job.completed")).toBeVisible();

  await panel.getByRole("button", { name: "Mark read" }).click();
  await expect(panel.getByRole("button", { name: "Mark read" })).toHaveCount(0);
  await expect(trigger.getByText("1")).toHaveCount(0);
});
