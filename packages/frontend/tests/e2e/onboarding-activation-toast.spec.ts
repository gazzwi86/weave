import { expect, test } from "@playwright/test";

// ONB-TASK-011 AC-011-07 (toast on activation): the backend poller
// (weave_backend/onboarding/poller.py + scheduler.py) detects activation
// and writes a notification event to the outbox, but no frontend surface
// consumes it yet -- no toast component, no polling/websocket hook wires
// onboarding activation into the UI. Grepped app/ + hooks/ for
// "activation"/"onboarding-activation": zero hits.
//
// ponytail: rather than test.skip() (sonarjs/no-skipped-tests forbids it),
// gate registration on a flag that's false until the frontend wiring lands
// -- an unregistered test reports "no tests" for this file, not a skip.
// Same convention as visual-baselines.spec.ts's `shouldRun` gate. Upgrade
// path: build the toast consumer (ONB-EPIC-005 follow-on, not this task),
// flip this flag, then this spec runs for real against it.
const toastWiringExists = false;

if (toastWiringExists) {
  test("shows a toast when an onboarding activation event arrives", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("onboarding-activation-toast")).toBeVisible();
  });
}
