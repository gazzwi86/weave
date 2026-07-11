import { expect, test } from "@playwright/test";
import type { Page, Request, Route } from "@playwright/test";

// Mirrors prompt-bar.spec.ts's login flow against the real mock OIDC
// provider + real uvicorn backend (SSR /dashboard fetches aren't
// interceptable by page.route, so login always goes through for real).
const PROMPT_INPUT_LABEL = "Describe the view you want";

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign in with Weave" }).click();
  await expect(page.getByRole("heading", { name: "Weave Mock OIDC — Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

const GENERATED_SPEC = {
  component_type: "bar_chart",
  title: "Entities by kind",
  data_source_contracts: ["CE-METRICS-1"],
  bindings: { field: "entity_count_by_kind" },
  column_span: 6,
  data_shape: "categorical",
};

// AC-1/m2-delta §2: `categorical` shape's compatible set (widget-compat.json)
// is bar_chart/pie_donut/table/ranked_list -- everything else must render
// disabled with a reason tooltip.
const INCOMPATIBLE = ["kpi_card", "line_area_chart", "activity_feed", "heatmap", "alert_banner"];
const COMPATIBLE = ["bar_chart", "pie_donut", "table", "ranked_list"];

function sseBody(): string {
  const blocks = [
    `event: spec\ndata: ${JSON.stringify(GENERATED_SPEC)}`,
    `event: data\ndata: ${JSON.stringify({ rows: { Person: 12, Process: 7 }, partial: false })}`,
    `event: done\ndata: ${JSON.stringify({ token_count: 42, widget_id: "w-viz-1" })}`,
  ];
  return blocks.join("\n\n") + "\n\n";
}

async function mockGenerate(page: Page): Promise<void> {
  await page.route("**/api/dashboard/widgets/generate", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody() });
  });
}

/** Tracks PATCH calls to the streamed widget's persistence endpoint and the
 * mutable "current" component type they leave behind, reused by the
 * `?scope=user` mock below to make the reload check reflect a real PATCH.
 */
async function trackPatch(page: Page): Promise<{ count: () => number; componentType: () => string }> {
  let count = 0;
  let componentType = "bar_chart";
  await page.route(
    (url) => url.pathname === "/api/dashboard/widgets/w-viz-1",
    async (route: Route) => {
      count += 1;
      const body = route.request().postDataJSON() as { spec: { component_type: string } };
      componentType = body.spec.component_type;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  );
  return { count: () => count, componentType: () => componentType };
}

async function mockUserScopeWidgets(page: Page, componentType: () => string): Promise<void> {
  await page.route(
    (url) => url.pathname === "/api/dashboard/widgets" && url.searchParams.get("scope") === "user",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          widgets: [
            {
              id: "w-viz-1",
              scope: "user",
              spec: { ...GENERATED_SPEC, component_type: componentType() },
              position: 0,
              last_result: { Person: 12, Process: 7 },
              fetched_at: "2026-07-11T00:00:00Z",
              status: "fresh",
              pending_fields: [],
              suggested: false,
            },
          ],
        }),
      });
    }
  );
}

async function assertMenuDisablesIncompatibleTypes(page: Page): Promise<void> {
  const select = page.getByTestId("change-viz-select");
  await expect(select).toBeVisible();
  for (const component of INCOMPATIBLE) {
    const option = select.locator(`option[value="${component}"]`);
    await expect(option).toBeDisabled();
    await expect(option).toHaveAttribute("title", /incompatible with categorical data/);
  }
  for (const component of COMPATIBLE) {
    await expect(select.locator(`option[value="${component}"]`)).toBeEnabled();
  }
}

// TASK-012 AC-5: `test_change_visualisation_flow` -- generate a bar-chart
// widget (mocked SSE, no live LLM per Plugin Law F), open Change
// visualisation, confirm incompatible types are visibly disabled with a
// reason, switching type re-renders held data with NO network call except
// the persistence PATCH, and the switch survives a reload.
test("change-visualisation flow: disables incompatible types, no re-fetch on switch, persists across reload (TASK-012 AC-5)", async ({
  page,
}) => {
  const patch = await trackPatch(page);
  await mockGenerate(page);
  await mockUserScopeWidgets(page, patch.componentType);

  await loginAndGoToDashboard(page);
  await page.getByTestId("prompt-bar-trigger").click();
  await page.getByLabel(PROMPT_INPUT_LABEL).fill("show entities by kind as a bar chart");
  await page.getByLabel(PROMPT_INPUT_LABEL).press("Enter");

  const status = page.getByTestId("prompt-bar-status");
  await expect(status).toContainText("Done", { timeout: 10_000 });

  await assertMenuDisablesIncompatibleTypes(page);

  // AC-5: switching type is a pure client re-render -- assert no /api/
  // request fires except the persistence PATCH.
  const otherApiRequests: string[] = [];
  const onRequest = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && url.pathname !== "/api/dashboard/widgets/w-viz-1") {
      otherApiRequests.push(url.pathname);
    }
  };
  page.on("request", onRequest);

  await page.getByTestId("change-viz-select").selectOption("table");

  await expect.poll(patch.count).toBe(1);
  page.off("request", onRequest);
  expect(otherApiRequests).toEqual([]);

  // Held data re-rendered in the new type -- same rows, table shape.
  await expect(page.getByText("Person")).toBeVisible();
  await expect(page.getByText("12")).toBeVisible();

  // Persistence: reload, refetch user-scope widgets, confirm the PATCHed
  // type survived and the PATCH itself fired exactly once (Law B: assert
  // real state via the mocked backend seam, not just UI memory).
  await page.reload();
  const widgets = (await page.evaluate(async () => {
    const res = await fetch("/api/dashboard/widgets?scope=user");
    return (await res.json()) as { widgets: { id: string; spec: { component_type: string } }[] };
  })) as { widgets: { id: string; spec: { component_type: string } }[] };
  const widget = widgets.widgets.find((w) => w.id === "w-viz-1");
  expect(widget?.spec.component_type).toBe("table");
  expect(patch.count()).toBe(1);
});
