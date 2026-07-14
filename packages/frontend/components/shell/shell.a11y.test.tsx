import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { WidgetTile } from "../dashboard/widget-tile";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

// ponytail: see components/ui/ui.a11y.test.tsx -- vitest-axe's matcher
// augmentation doesn't type-check under vitest 4, so violations are
// asserted directly off axe-core's own result shape.
async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

describe("shell a11y", () => {
  it("Nav has no axe violations", async () => {
    const { container } = render(<Nav />);
    await expectNoAxeViolations(container);
  });

  it("HelpLauncher trigger has no axe violations", async () => {
    const { container } = render(<HelpLauncher />);
    await expectNoAxeViolations(container);
  });

  it("WidgetTile has no axe violations", async () => {
    const { container } = render(
      <WidgetTile
        widget={{
          id: "w-1",
          scope: "tenant_default",
          spec: {
            component_type: "kpi_card",
            title: "Entities in model",
            data_source_contracts: ["CE-METRICS-1"],
            bindings: { field: "entity_count_by_kind", aggregate: "sum" },
            column_span: 3,
          },
          position: 0,
          last_result: 42,
          fetched_at: "2026-07-10T12:00:00Z",
          status: "fresh",
          pending_fields: [],
          suggested: false,
          refresh_interval_s: 300,
        }}
      />
    );
    await expectNoAxeViolations(container);
  });
});
