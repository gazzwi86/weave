import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Mirrors auth.spec.ts's flow against the mock OIDC provider -- same
// duplication call as compliance.spec.ts/billing.spec.ts.
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

// QA WARN fix: fcose's entrance-animation layout calls fit() once it
// finishes (~600ms), which pans/zooms the canvas and fires a *genuine*
// late "viewport" change -- a DOM-polling "stable for two reads" heuristic
// can still land on a mid-animation plateau and false-positive. Wait for
// the real `layoutstop` event (exposed via the dev-only window hook)
// instead of guessing from snapshots.
async function waitOneAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
  // The "layoutstop"-triggered "viewport" event's minimap update is
  // rAF-throttled (raf-throttle.ts) -- it can still be one animation frame
  // away from painting when the flag above flips. Flush two frames so the
  // minimap's DOM style attribute reflects the final steady state before
  // the "before" snapshot is taken (residual sub-pixel flake otherwise).
  await waitOneAnimationFrame(page);
  await waitOneAnimationFrame(page);
}

const NODE_KINDS = { kinds: [{ id: "Process", label: "Process", colour: "#3B82F6" }] };

const SPARQL_PAGE = {
  rows: [
    {
      subject: "https://weave.example/process/onboarding",
      predicate: "https://weave.example/hasStep",
      object: "https://weave.example/step/create-account",
      bpmo_kind: "Process",
      label: "Customer Onboarding",
    },
  ],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

// TASK-002 E2E requirement #1 (AC-1/AC-3/AC-4): sign in, land on the whole-
// company canvas, and prove it actually rendered real CE-READ-1 data (not
// just an empty container) -- Cytoscape draws to <canvas>, so the fetched
// element data is asserted via the dev-only window hook instead of DOM text.
test("renders labelled nodes on the force canvas for an authenticated viewer on first load", async ({
  page,
}) => {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SPARQL_PAGE) });
  });

  await loginAndGoToExplorer(page);

  await expect(page.getByTestId("explorer-canvas")).toBeVisible();
  await expect(page.getByTestId("explorer-minimap")).toBeVisible();

  // Canvas element mounts before the fetch settles -- wait for the
  // dev-only introspection hook (set once, after load finishes) rather
  // than racing it.
  await page.waitForFunction(() => window.__explorerElements !== undefined, undefined, { timeout: 15_000 });

  const elements = await page.evaluate(() => window.__explorerElements);
  expect(elements?.some((el) => el.data.label === "Customer Onboarding" && el.data.bpmo_kind === "Process")).toBe(
    true,
  );
});

// TASK-002 E2E requirement #2 (AC-7): a global Cmd/Ctrl+0 must only fit the
// canvas when the canvas itself holds focus -- proven here by showing the
// mini-map's viewport indicator (driven by cy's real "viewport" event) does
// not move when the shortcut fires while an unrelated text input is focused.
test("does not capture global Cmd+0 when a text input outside the canvas has keyboard focus", async ({
  page,
}) => {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SPARQL_PAGE) });
  });

  await loginAndGoToExplorer(page);
  await expect(page.getByTestId("explorer-canvas")).toBeVisible();

  // Simulates "a text input outside the canvas" (AC-7's scoping condition) --
  // the shell has no standing search field yet, so one is injected for this
  // assertion, matching what key-bindings.test.ts already covers in jsdom.
  const outsideInput = page.locator("#e2e-outside-input");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "e2e-outside-input";
    document.body.appendChild(input);
  });
  await outsideInput.focus();

  // Wait for fcose's entrance-animation layout to settle before snapshotting
  // "before" -- otherwise the layout's own ongoing motion (unrelated to the
  // Cmd+0 scoping under test) can still drift the indicator mid-snapshot.
  await waitForLayoutSettled(page);
  const before = await page.getByTestId("explorer-minimap-viewport").getAttribute("style");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+0" : "Control+0");
  const after = await page.getByTestId("explorer-minimap-viewport").getAttribute("style");

  expect(after).toBe(before);
});
