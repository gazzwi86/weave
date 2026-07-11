import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// NOTE (coordinator): authored against the real (unmocked) backend --
// requires the live dev stack (docker-compose) with the demo tenant seeded
// (seed_demo.py), same precedent as versions-publish.spec.ts.

// Same rank note as versions-publish.spec.ts: admin@weave.local is the
// only seeded account with "admin" rank, needed here too (Rules screen
// itself only needs "read", but seeding a Warning-severity Activity via
// POST /api/operations/apply needs at least "author").
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/ce/rules");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill("admin@weave.local");
  await page.getByLabel("Tenant").fill("acme-corp");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ce\/rules$/);
  await page.waitForLoadState("networkidle");
}

// AC-006-03/-04/-05/-07: nav-reachable Rules & Policies screen shows the
// honest pending state, then (Law B) a real SHACL run against a real
// backend write surfaces a genuine Warning-severity violation with a
// working link to the violating entity's resource view.
test("Rules & Policies: pending state, real run, severity + violating-entity link (Law B)", async ({
  page,
}) => {
  await loginAsAdmin(page);

  // AC-006-04's pending-vs-cached distinction is unit + integration tested
  // (test_operations_validate_report.py, test_validate_api.py); a repeat
  // run of this spec against the same seeded tenant may already have a
  // cached report from a prior run, so accept either honest state here --
  // this test's job is proving the real-write -> real-run -> link chain.
  await expect(page.getByTestId("rules-pending").or(page.getByTestId("rule-list"))).toBeVisible();

  const label = `E2E Bare Activity ${Date.now()}`;
  const apply = await page.request.post("/api/operations/apply", {
    data: { operations: [{ op: "add_node", ref: "a1", kind: "Activity", label }] },
  });
  expect(apply.ok()).toBe(true);
  const { ref_map } = (await apply.json()) as { ref_map: Record<string, string> };
  const activityIri = ref_map.a1;
  if (!activityIri) throw new Error("ref_map.a1 missing from apply response");

  const runButton = page.getByRole("button", { name: "Run validation" });
  if (await runButton.isVisible()) {
    await runButton.click();
  } else {
    // Already showing a cached report from a prior run of this spec
    // against the same seeded tenant -- reload to pick up the write above.
    await page.reload();
    await page.getByRole("button", { name: "Run validation" }).click();
  }
  await expect(page.getByTestId("rule-list")).toBeVisible();
  // ActivityShape's catalogue severity is the highest across its own
  // properties (label=Violation, description=Warning) -- see
  // shacl.py::_rule_severity -- so the row severity badge reads
  // "Violation", not "Warning". The individual Warning-severity result is
  // still proven by the violating-entity link assertion below.
  await expect(page.getByText("Violation").first()).toBeVisible();

  const violatingLink = page.getByRole("link", { name: activityIri });
  await expect(violatingLink).toBeVisible();
  await expect(violatingLink).toHaveAttribute(
    "href",
    `/explorer?focus=${encodeURIComponent(activityIri)}`
  );
});

test("Rules & Policies has no axe violations", async ({ page }) => {
  await loginAsAdmin(page);
  // Runs after the mutating test above (workers: 1, file order), so the
  // report may already be cached (not pending) -- either state is a valid
  // render to axe-check.
  await expect(page.getByTestId("rules-pending").or(page.getByTestId("rule-list"))).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
