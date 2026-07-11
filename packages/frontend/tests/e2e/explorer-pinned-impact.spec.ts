import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { OQ09_PREDICATE_CLOSURE } from "@/lib/explorer/closure-config";
import { walkClosure, type TripleLike } from "@/lib/explorer/traversal-walk";

// Mirrors explorer-node-spotlight.spec.ts's login flow against the mock OIDC
// provider -- same duplication call as every other explorer spec.
async function loginAndGoToExplorer(page: Page): Promise<void> {
  await page.goto("/explorer");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
}

async function waitOneAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function waitForLayoutSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__explorerLayoutSettled === true);
  await waitOneAnimationFrame(page);
  await waitOneAnimationFrame(page);
}

async function borderWidth(page: Page, nodeId: string): Promise<string | undefined> {
  return page.evaluate((id) => window.__explorerNodeInfo?.(id)?.borderWidth, nodeId);
}

const JSON_CONTENT_TYPE = "application/json";
const NODE_KINDS = {
  kinds: [
    { id: "Process", label: "Process", colour: "#3B82F6" },
    { id: "Policy", label: "Policy", colour: "#F59E0B" },
    { id: "DataAsset", label: "Data Asset", colour: "#10B981" },
  ],
};

// Same named brief example as the AC-6 mirror-consistency unit test
// (impact-dependency-mirror-consistency.test.ts) -- one fixture, reused
// here so the pin's traceResult is a genuine walkClosure() output, not a
// hand-picked list (team-lead: "in-memory closure walk ... not a live
// SPARQL client in this task").
const NS = "https://weave.io/ontology/";
const POLICY1 = "urn:Policy1";
const PROCESS1 = "urn:Process1";
const DATA_ASSET1 = "urn:DataAsset1";
const FIELD1 = "urn:Field1";

const FIXTURE: TripleLike[] = [
  { subject: PROCESS1, predicate: `${NS}governedBy`, object: POLICY1 },
  { subject: PROCESS1, predicate: `${NS}consumes`, object: DATA_ASSET1 },
  // Gives DataAsset1 its own bpmo_kind row below (a filterable entity
  // type unrelated to the pinned trace) -- otherwise it only ever
  // appears as an object, never a subject, and the filter panel has no
  // checkbox for it (TypeToggleList only lists kinds actually assigned).
  { subject: DATA_ASSET1, predicate: `${NS}hasField`, object: FIELD1 },
];

const SPARQL_PAGE = {
  // DataAsset1's own row (where it's the subject) must come before it
  // ever appears as an object -- map-rows-to-elements.ts only sets a
  // node's bpmo_kind the FIRST time it's upserted, and a bare object
  // reference upserts with no kind.
  rows: [
    { subject: DATA_ASSET1, predicate: `${NS}hasField`, object: FIELD1, bpmo_kind: "DataAsset" },
    { subject: PROCESS1, predicate: `${NS}governedBy`, object: POLICY1, bpmo_kind: "Process" },
    { subject: PROCESS1, predicate: `${NS}consumes`, object: DATA_ASSET1, bpmo_kind: "Process" },
  ],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

async function mockGraphFetch(page: Page): Promise<void> {
  await page.route("**/api/proxy/node-kinds", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(NODE_KINDS) });
  });
  await page.route("**/api/proxy/sparql**", async (route) => {
    await route.fulfill({ status: 200, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(SPARQL_PAGE) });
  });
}

// AC-3: pin an impact trace (dependency of the Policy that governs
// Process1), then pan, zoom, and toggle an unrelated filter -- the amber
// trace border on the pinned member must survive all three.
test("pinning an impact trace persists the highlight through pan, zoom, and filter (AC-3)", async ({ page }) => {
  await mockGraphFetch(page);
  await loginAndGoToExplorer(page);
  await waitForLayoutSettled(page);

  // Same direction as the AC-6 unit test's proven "Policy change reaches
  // the governed Process" example (impact-dependency-mirror-consistency.
  // test.ts) -- impact(Policy1) walks governedBy's inverse leg to Process1.
  const memberIris = [...walkClosure(FIXTURE, OQ09_PREDICATE_CLOSURE, "impact", POLICY1, 6)];
  expect(memberIris).toContain(PROCESS1);

  await page.evaluate(
    ([sourceIri, members]) => window.__explorerPinImpactTrace?.(sourceIri, members),
    [POLICY1, memberIris] as [string, string[]]
  );
  await expect.poll(async () => borderWidth(page, PROCESS1)).toBe("3px");

  // Pan: drag an empty patch of canvas (well clear of both nodes).
  const canvasBox = await page.locator('[data-testid="explorer-canvas"]').boundingBox();
  if (canvasBox) {
    const startX = canvasBox.x + 20;
    const startY = canvasBox.y + 20;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 40, { steps: 5 });
    await page.mouse.up();
  }
  await expect.poll(async () => borderWidth(page, PROCESS1)).toBe("3px");

  // Zoom: wheel over the canvas.
  await page.mouse.wheel(0, -200);
  await waitOneAnimationFrame(page);
  await expect.poll(async () => borderWidth(page, PROCESS1)).toBe("3px");

  // Filter: toggle an unrelated entity kind off and back on.
  await page.getByRole("checkbox", { name: "DataAsset" }).click();
  await expect.poll(async () => borderWidth(page, PROCESS1)).toBe("3px");

  // Unpin: the trace class clears.
  await page.evaluate((sourceIri) => window.__explorerUnpinImpactTrace?.(sourceIri), POLICY1);
  await expect.poll(async () => borderWidth(page, PROCESS1)).toBe("0px");
});
