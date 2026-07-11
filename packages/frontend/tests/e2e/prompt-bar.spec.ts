import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors dashboard-widgets.spec.ts / build-request.spec.ts's login flow
// against the real mock OIDC provider + real uvicorn backend (no
// page.route mocks -- SSR server-component fetches on /dashboard don't see
// them; Law B requires asserting real backend state anyway).
const PROMPT_INPUT_LABEL = "Describe the view you want";

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Cold Next.js dev compile can lag first paint (see ce-authoring.spec.ts);
  // without this, the Cmd+K test's single keyboard.press below can race
  // React's hydration and fire before the window keydown listener attaches.
  await page.waitForLoadState("networkidle");
}

test.describe("prompt bar (TASK-011 AC-8, AC-4)", () => {
  test("opens via Cmd+K and via its trigger button, shows example prompts while empty", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);

    // Cmd+K opens the dialog (AC-8: "keyboard-focusable"). Lowercase "k" --
    // real Cmd+K (no Shift held) reports `event.key === "k"`, which is what
    // the app's own listener checks; Playwright's "Meta+K" shorthand
    // produces `event.key === "K"` instead and would never match.
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog", { name: "Generate a dashboard widget" });
    await expect(dialog).toBeVisible();
    // Cmd+K again closes it (toggle) -- confirms the trigger button path
    // independently below rather than assuming toggle semantics here.
    await page.keyboard.press("Meta+k");
    await expect(dialog).not.toBeVisible();

    await page.getByTestId("prompt-bar-trigger").click();
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(PROMPT_INPUT_LABEL)).toBeFocused();

    // AC-8: 4-6 role-tailored, GA-scoped example prompts show while the bar
    // is empty and no widgets have been generated this session.
    const examples = dialog.locator("ul li button");
    await expect(examples.first()).toBeVisible();
    const count = await examples.count();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(6);
  });

  // AC-4: ADR-018 -- once TASK-012's real resolver landed, the shared
  // Playwright backend needed a genuinely reachable provider (Ollama, see
  // the happy-path test below) so this suite can no longer also force a
  // real provider outage on demand. AC-4's named-state coverage stays real
  // and deterministic at two other levels instead:
  // `test_provider_503_named_state` (integration, fake-resolver dependency
  // override) and "renders a named, retryable state for provider_503"
  // (prompt-bar.test.tsx, mocked SSE stream). See ADR-018 for the trade-off.

  // AC-8/AC-2/AC-3 (TASK-012): skeleton -> widget fill -> footer, plus the
  // Law B backend-state check (a newly generated, suggested=false widget
  // appears via GET /api/dashboard/widgets?scope=user). Needs the real
  // classifying resolver plus a reachable provider (playwright.config.ts
  // wires WEAVE_MODEL_PROVIDER=ollama into the backend webServer, ADR-018).
  // "show entities by kind" is a GA-scoped example prompt (CE-METRICS-1),
  // so it always resolves to a real WidgetSpec, never source_not_ga.
  test("prompt-to-widget-stream: skeleton fills to a real widget, backend row exists (Law B)", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await page.keyboard.press("Meta+k");

    await page.getByLabel(PROMPT_INPUT_LABEL).fill("show entities by kind");
    await page.getByLabel(PROMPT_INPUT_LABEL).press("Enter");

    // Real Ollama inference, not the ~1s UI-only latency target -- give the
    // streaming skeleton real time to appear and then resolve to done.
    await expect(page.locator("[aria-busy]")).toBeVisible({ timeout: 5_000 });
    const status = page.getByTestId("prompt-bar-status");
    await expect(status).toContainText("Done", { timeout: 30_000 });
    await expect(status).toContainText("CE-METRICS-1");

    // Law B: assert real backend state changed, not just the UI -- the
    // generated widget is a real, suggested=false row via the real proxy.
    const widgets = (await page.evaluate(async () => {
      const res = await fetch("/api/dashboard/widgets?scope=user");
      return res.json();
    })) as { widgets: { suggested: boolean; spec: { data_source_contracts: string[] } }[] };
    const generated = widgets.widgets.find(
      (w) => !w.suggested && w.spec.data_source_contracts.includes("CE-METRICS-1")
    );
    expect(generated).toBeTruthy();
  });
});
