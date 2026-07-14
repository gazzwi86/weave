import { expect, test } from "@playwright/test";

// ONB-TASK-015 AC-015-04 / testing-strategy.md §4 `activation.spec`: first
// entity committed in the user's OWN workspace fires toast + checklist item
// + exactly one PLAT-NOTIFY-1 publish; a re-trigger produces nothing.
// Composes onboarding-activation-toast.spec.ts's gate (frontend toast
// wiring doesn't exist yet -- same `toastWiringExists` convention) with the
// backend exactly-once assertion the implementation hint calls out: count
// both the notify stub call AND the outbox row, both must equal one.
//
// ponytail: sandbox has no Postgres for Playwright webServer -- enforced at
// real-env epic-close. Frontend toast consumer also doesn't exist yet
// (onboarding-activation-toast.spec.ts's own gate) -- both gaps close
// together at real-env epic-close, tracked as a single deferred spec.
test.fixme(
  "first own-workspace commit fires toast + checklist once; re-trigger fires nothing (AC-015-04)",
  async ({ page }) => {
    await page.goto("/ce");
    await page.getByRole("button", { name: "Sign in with Weave" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();

    // Commit into the user's OWN workspace (not the sandbox) -- the
    // activation trigger per ADR-003.
    await page.request.post("/api/tenancy/workspaces/own/switch");
    await page.getByRole("textbox", { name: /ask weave/i }).fill("add a process called Onboard vendor");
    await page.getByRole("button", { name: /send|submit/i }).click();

    await expect(page.getByTestId("onboarding-activation-toast")).toBeVisible();
    await expect(page.getByRole("listitem", { name: /first entity/i })).toHaveAttribute(
      "data-checklist-state",
      "complete",
    );

    // Backend-state assertion (Law B, implementation hint): exactly one
    // activation row, one outbox row, one PLAT-NOTIFY-1 stub call.
    const state = await page.request.get("/api/onboarding/state");
    const body = await state.json();
    expect(body.activation).not.toBeNull();

    const outbox = await page.request.get("/api/onboarding/_debug/outbox-count");
    expect((await outbox.json()).count).toBe(1);
    const notifyCalls = await page.request.get("/api/onboarding/_debug/notify-stub-call-count");
    expect((await notifyCalls.json()).count).toBe(1);

    // Re-trigger: a second own-workspace commit must not fire again.
    await page.getByRole("textbox", { name: /ask weave/i }).fill("add a process called Second entity");
    await page.getByRole("button", { name: /send|submit/i }).click();
    await page.reload();
    await expect(page.getByTestId("onboarding-activation-toast")).toHaveCount(0);

    const outboxAfter = await page.request.get("/api/onboarding/_debug/outbox-count");
    expect((await outboxAfter.json()).count).toBe(1);
    const notifyCallsAfter = await page.request.get("/api/onboarding/_debug/notify-stub-call-count");
    expect((await notifyCallsAfter.json()).count).toBe(1);
  },
);
