import { expect, test } from "@playwright/test";

// ONB-TASK-015 AC-015-02 / testing-strategy.md §4 `persistence-reset.spec`:
// edit the sandbox (NL edit, CE-02), sign out/in, edit persists, an
// explicit reset restores canonical within the 30s target, exercise flags
// clear, activation is retained. Reuses the sign-in flow the other
// onboarding specs already model.
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close, same convention as the other onboarding E2E specs.
test.fixme(
  "sandbox edit survives sign-out/sign-in; explicit reset restores canonical <=30s, clears exercises, keeps activation (AC-015-02)",
  async ({ page }) => {
    await page.goto("/ce?prompt=1");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/ce/);

    // Edit via NL prompt (CE-02) so the sandbox graph actually changes.
    await page.getByRole("textbox", { name: /ask weave/i }).fill("add a note node called E2E marker");
    await page.getByRole("button", { name: /send|submit/i }).click();
    await expect(page.getByText("E2E marker")).toBeVisible();

    // Sign out / sign back in -- edit must still be there (Law B: assert via
    // CE-READ-1 ASK, not just the DOM re-rendering the same client cache).
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/ce");
    await expect(page.getByText("E2E marker")).toBeVisible();

    const askAfterEdit = await page.request.post("/api/ce/query", {
      data: { ask: 'ASK { ?s <http://www.w3.org/2000/01/rdf-schema#label> "E2E marker" }' },
    });
    expect((await askAfterEdit.json()).boolean).toBe(true);

    // Seed an exercise completion + activation so the reset's selective
    // clear (exercises cleared, activation retained) is actually exercised.
    await page.request.post("/api/onboarding/exercises/ex-1/check", {
      data: { verified_signal: "nav_signal" },
    });

    const resetStart = Date.now();
    const resetResponse = await page.request.post("/api/onboarding/sandbox/reset");
    const resetDurationMs = Date.now() - resetStart;
    expect(resetResponse.ok()).toBe(true);
    // Server-reported op duration, not wall-clock browser time -- CI
    // machines vary (per the task brief's implementation hint).
    const resetBody = await resetResponse.json();
    expect(resetBody.duration_ms).toBeLessThanOrEqual(30_000);
    // Wall-clock sanity ceiling only, not the pass/fail assertion itself.
    expect(resetDurationMs).toBeLessThan(60_000);

    await page.reload();
    await expect(page.getByText("E2E marker")).toHaveCount(0);

    const state = await page.request.get("/api/onboarding/state");
    const stateBody = await state.json();
    expect(stateBody.exercise_completions).toEqual([]);
    expect(stateBody.activation).not.toBeNull();
  },
);
