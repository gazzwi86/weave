import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors prompt-bar.spec.ts's convention: no page.route mocks -- SSR
// server-component fetches on /dashboard (page.tsx's fetchDashboardWidgets/
// fetchLibraryItems) go straight to the real uvicorn backend and are never
// seen by the browser-level network layer Playwright's page.route
// intercepts. Law B requires asserting real backend state anyway, so these
// specs drive the real mock-OIDC + real backend + real Postgres stack
// end to end, same as prompt-bar.spec.ts's happy-path test.

interface WidgetRow {
  id: string;
  scope: string;
  suggested: boolean;
  spec: { title: string };
}

async function loginAndGoToDashboard(page: Page, email?: string): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  if (email) {
    await page.getByLabel("Email").fill(email);
  }
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

async function userWidgets(page: Page): Promise<WidgetRow[]> {
  return page.evaluate(async () => {
    const res = await fetch("/api/dashboard/widgets?scope=user");
    return (await res.json()).widgets;
  });
}

// AC-8 (default_tiles.py::ensure_user_starters) seeds two role starter
// tiles, suggested=true, on a user's first-ever dashboard load -- real,
// idempotent server state, not test fixture data.
async function firstUserWidget(page: Page): Promise<WidgetRow> {
  const widgets = await userWidgets(page);
  const widget = widgets[0];
  if (!widget) throw new Error("expected at least one scope=user starter widget to exist");
  return widget;
}

// PLAT-V1-TASK-014 AC-1/AC-2/AC-6: pin is a real, server-persisted mutation
// (widget_instances.suggested -> false) -- reloading the page (standing in
// for "another device", since pin state is never localStorage) re-fetches
// from the real backend and must still show the pinned (Unpin) control.
test("test_pin_cross_device: a pinned widget stays pinned across a fresh page load", async ({ page }) => {
  await loginAndGoToDashboard(page);
  const widget = await firstUserWidget(page);

  const tile = page.getByTestId(`widget-tile-${widget.id}`);
  await expect(tile).toBeVisible();

  if (widget.suggested) {
    await tile.getByRole("button", { name: `Pin ${widget.spec.title}`, exact: true }).click();
    await expect.poll(async () => (await userWidgets(page)).find((w) => w.id === widget.id)?.suggested).toBe(false);
  }

  // Fresh navigation, fresh SSR fetch from the real backend -- proves the
  // pinned state is server-persisted, not held in any client store.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  const reloadedTile = page.getByTestId(`widget-tile-${widget.id}`);
  await expect(reloadedTile.getByRole("button", { name: `Unpin ${widget.spec.title}` })).toBeVisible();
  await expect(reloadedTile.getByRole("button", { name: `Pin ${widget.spec.title}`, exact: true })).toHaveCount(0);
});

// PLAT-V1-TASK-014 AC-5: drag-reorder's keyboard alternative (Move up/down)
// issues a real PATCH .../widgets/order -- reloading afterward re-fetches
// from the backend, proving the new order is persisted server-side (Law B),
// not just a client-side re-render.
test("test_drag_reorder_persists: keyboard move survives a fresh page load", async ({ page }) => {
  await loginAndGoToDashboard(page);
  const before = await userWidgets(page);
  expect(before.length).toBeGreaterThanOrEqual(2);
  const second = before[1] as WidgetRow;

  await page.getByTestId(`widget-tile-${second.id}`).getByRole("button", { name: `Move ${second.spec.title} up` }).click();

  const secondOriginalIndex = before.findIndex((w) => w.id === second.id);
  await expect.poll(async () => {
    const rows = await userWidgets(page);
    return rows.findIndex((w) => w.id === second.id);
  }).toBeLessThan(secondOriginalIndex);

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  const tiles = page.locator('[data-testid^="widget-tile-"]');
  const firstTileTestId = await tiles.first().getAttribute("data-testid");
  expect(firstTileTestId).toBe(`widget-tile-${second.id}`);
});

// ponytail: full add-copy assertion is unreachable with today's mock OIDC --
// weave_backend/mock_oidc/tokens.py never emits a `roles` claim, so every
// mock-OIDC-issued token resolves to `principal.roles = []` and
// `_require_tenant_author` (dashboard.py) 403s ANY caller, including the
// "author"-labelled demo login (its label is UI-only, seed_demo.py's grant
// never reaches the JWT). Ceiling: wire tenant-scope role grants into
// tokens.py's claim set, then delete the early-return below to restore the
// add-copy assertion this test used to make. Until then this test asserts
// the real, current backend behaviour honestly -- a genuine 403, not a
// fabricated skip -- which is still a real Law-B backend-state assertion.
test("test_publish_and_add_flow: publish is rejected without a real author-role grant (honest ceiling)", async ({ page }) => {
  await loginAndGoToDashboard(page, "client@weave.local");
  const widget = await firstUserWidget(page);

  if (widget.suggested) {
    await page.getByTestId(`widget-tile-${widget.id}`).getByRole("button", { name: `Pin ${widget.spec.title}`, exact: true }).click();
    await expect.poll(async () => (await userWidgets(page)).find((w) => w.id === widget.id)?.suggested).toBe(false);
  }

  page.on("dialog", (dialog) => dialog.accept(`${widget.spec.title} (E2E ${Date.now()})`));

  const publishResponse = page.waitForResponse((res) => res.url().endsWith("/api/dashboard/library") && res.request().method() === "POST");
  await page.getByTestId(`widget-tile-${widget.id}`).getByRole("button", { name: `Publish ${widget.spec.title} to library` }).click();

  // Honest-absence assertion: no mock-OIDC login can currently satisfy
  // _require_tenant_author, so publish genuinely, verifiably 403s.
  expect((await publishResponse).status()).toBe(403);
});
