import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ONB-TASK-015 AC-015-02 / testing-strategy.md §4 `exercise.spec`: Business
// path NL query (CE-03b) completes, Technical path SPARQL (CE-03) completes,
// GE-01 spotlight check completes -- each asserting the completion row's
// `verified_signal`, not just a UI checkmark.
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close, same convention as the other onboarding E2E specs.
test.describe("exercise round-trips (AC-015-02, TASK-009)", () => {
  test.fixme(
    "Business path: NL query exercise completes via nl_query signal, never raw SPARQL",
    async ({ page }) => {
      await page.goto("/ce?prompt=1");
      await page.getByRole("button", { name: "Sign in with Weave" }).click();
      await page.getByLabel("Email").fill("business@weave.local");
      await page.getByRole("button", { name: "Sign in" }).click();

      await page.getByRole("textbox", { name: /ask weave/i }).fill("how many processes do we have");
      await page.getByRole("button", { name: /send|submit/i }).click();
      await expect(page.getByText(/exercise complete/i)).toBeVisible();

      const state = await page.request.get("/api/onboarding/state");
      const body = await state.json();
      const completion = body.exercise_completions.find((c: { exercise_id: string }) => c.exercise_id === "ex-ce-03b");
      expect(completion.verified_signal).toBe("nl_query");

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    },
  );

  test.fixme("Technical path: raw SPARQL exercise completes via sparql_ask signal", async ({ page }) => {
    await page.goto("/ce/query");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByLabel("Email").fill("technical@weave.local");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("textbox", { name: /sparql/i }).fill("ASK { ?s ?p ?o }");
    await page.getByRole("button", { name: /run/i }).click();
    await expect(page.getByText(/exercise complete/i)).toBeVisible();

    const state = await page.request.get("/api/onboarding/state");
    const body = await state.json();
    const completion = body.exercise_completions.find((c: { exercise_id: string }) => c.exercise_id === "ex-ce-03");
    expect(completion.verified_signal).toBe("sparql_ask");
  });

  test.fixme("GE-01: spotlight-check exercise completes via canvas_state signal", async ({ page }) => {
    await page.goto("/explorer");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("button", { name: /spotlight/i }).click();
    await expect(page.getByText(/exercise complete/i)).toBeVisible();

    const state = await page.request.get("/api/onboarding/state");
    const body = await state.json();
    const completion = body.exercise_completions.find((c: { exercise_id: string }) => c.exercise_id === "ex-ge-01");
    expect(completion.verified_signal).toBe("canvas_state");
  });
});
