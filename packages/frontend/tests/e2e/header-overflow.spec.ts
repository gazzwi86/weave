import { expect, test } from "@playwright/test";

// S1 (docs/design/remediation-2-api-gaps.md): AppHeader's centre wrapper had
// no `min-w-0`, so the CommandBarTrigger stayed at intrinsic width and the
// header overflowed once the nav rail + secondary sidebar narrowed the
// content column -- pushing the right-hand cluster (bell/help/avatar)
// off-viewport. Reproduced at 1280x900 with the /ce secondary sidebar open.
test.use({ viewport: { width: 1280, height: 900 } });

test("header right cluster (bell, account) stays on-viewport with the secondary sidebar open", async ({
  page,
}) => {
  await page.goto("/ce");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce$/);

  const bell = page.getByRole("button", { name: "Notifications" });
  const account = page.getByRole("button", { name: "Account menu" });
  await expect(bell).toBeVisible();
  await expect(account).toBeVisible();

  const bellBox = await bell.boundingBox();
  const accountBox = await account.boundingBox();
  expect(bellBox).not.toBeNull();
  expect(accountBox).not.toBeNull();

  expect(bellBox!.x + bellBox!.width).toBeLessThanOrEqual(1280);
  expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(1280);
});
