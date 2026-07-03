import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { DashboardPlaceholder } from "../dashboard/dashboard-placeholder";
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

  it("DashboardPlaceholder has no axe violations", async () => {
    const { container } = render(<DashboardPlaceholder />);
    await expectNoAxeViolations(container);
  });
});
