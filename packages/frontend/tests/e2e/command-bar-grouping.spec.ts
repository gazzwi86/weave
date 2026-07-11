import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider.
async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// AC-3: grouped CommandBar (Navigation/Entities/Actions) with keyboard nav.
// test_cmd_k_opens_grouped_command_bar_with_keyboard_nav
test("Cmd+K opens the grouped CommandBar, navigates with arrow keys, and selects a Navigation result", async ({
  page,
}) => {
  await loginAndGoToDashboard(page);

  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Global search" });
  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();

  await input.fill("constit");
  await expect(dialog.getByText("Navigation")).toBeVisible();
  const navResult = dialog.getByRole("option", { name: "Constitution" });
  await expect(navResult).toBeVisible();

  // cmdk owns arrow-key selection natively; Enter activates the highlighted item.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/ce$/);
});
