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

  // AC-4 (real backend, Law B): TASK-012's resolver hasn't landed yet --
  // `dashboard/intent.py::resolve` unconditionally raises
  // `ProviderUnavailable` in every deployed env today, so this is the one
  // full round-trip state a real (non-mocked) generate call can honestly
  // reach right now. Confirms the SSE stream really terminates in the named
  // `provider_503` state end-to-end, not just against the unit-test fetch
  // stub in prompt-bar.test.tsx.
  test("submitting a prompt against the real backend surfaces the named provider_503 state", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await page.getByTestId("prompt-bar-trigger").click();

    await page.getByLabel(PROMPT_INPUT_LABEL).fill("show entities by kind");
    await page.getByLabel(PROMPT_INPUT_LABEL).press("Enter");

    await expect(page.getByText("AI provider unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  // RELOCATED to PLAT-V1-TASK-012, not deleted (team-lead call, logged
  // against TASK-012). Happy-path slice of AC-8/AC-2/AC-3 (skeleton -> widget
  // fill -> footer) plus the Law B backend-state check (newly generated,
  // suggested=false widget appears via GET /api/dashboard/widgets?scope=user)
  // both need a real classifying resolver. dashboard/intent.py::resolve is a
  // deliberate stub that ALWAYS raises ProviderUnavailable -- not env-gated
  // like billing.py's harness_router, and Playwright drives a real
  // subprocess uvicorn, so an in-process dependency_overrides fake resolver
  // can't reach it either. No seam to make this real without TASK-012 itself
  // (a WEAVE_ENV-gated stand-in here would be throwaway scaffolding TASK-012
  // immediately supersedes -- its own dev target already wires a real local
  // Ollama resolver, see root Makefile). This intent moves to TASK-012's own
  // test file when that resolver lands.
  test.fixme(
    "prompt-to-widget-stream: skeleton fills to a real widget, backend row exists (Law B)",
    async () => {
      // Cmd+K -> submit -> aria-busy skeleton within ~1s -> widget fills ->
      // data-testid="prompt-bar-status" footer shows the data source ->
      // GET /api/dashboard/widgets?scope=user shows the new suggested=false
      // widget -- blocked on TASK-012 (see comment above).
    }
  );
});
