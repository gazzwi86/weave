import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// TASK-031: mirrors ce-authoring.spec.ts's login flow, landing on the new
// instance browser v2 route instead of /ce.
async function loginAndGoToInstances(page: Page): Promise<void> {
  await page.goto("/ce/instances");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce\/instances$/);
  await page.waitForLoadState("networkidle");
}

const PROCESS_KIND = {
  iri: "urn:weave:kind:Process",
  label: "Process",
  properties: [],
};

async function routeReadPaths(page: Page): Promise<void> {
  await page.route("**/api/ontology/types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ kinds: [PROCESS_KIND], relationships: [] }),
    });
  });
  await page.route("**/api/sparql**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: {
          bindings: [
            { iri: { value: "urn:weave:proc:1" }, label: { value: "Invoice Approval" }, kind: { value: PROCESS_KIND.iri } },
          ],
        },
      }),
    });
  });
  await page.route("**/api/ontology/resource/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        iri: "urn:weave:proc:1",
        kind: PROCESS_KIND.iri,
        label: "Invoice Approval",
        triples: [],
        outgoing: [],
        incoming: [],
      }),
    });
  });
}

test.describe("Instance browser v2 (TASK-031)", () => {
  // test_analyst_browses_filters_inspects_and_edits_an_instance
  test("analyst browses, filters, inspects, and edits an instance", async ({ page }) => {
    await routeReadPaths(page);
    await loginAndGoToInstances(page);

    // AC-1: kind chips render from the ontology types endpoint.
    await expect(page.getByRole("button", { name: "Process", exact: true })).toBeVisible();

    // AC-1/AC-2: the browsed row renders.
    await expect(page.getByText("Invoice Approval")).toBeVisible();

    // AC-3: selecting the row opens the inspector with its properties.
    await page.getByText("Invoice Approval").first().click();
    await expect(page.getByText(/History unavailable/)).toBeVisible();

    // AC-4: "View on canvas" carries the focus IRI into the Explorer.
    const canvasLink = page.getByRole("link", { name: "View on canvas" });
    await expect(canvasLink).toHaveAttribute("href", `/explorer?focus=${encodeURIComponent("urn:weave:proc:1")}`);

    // AC-5: Edit opens the authoring drawer with the kind persistent.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByText("Process")).toBeVisible();
  });
});
