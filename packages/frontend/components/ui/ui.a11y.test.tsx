import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardTitle } from "./card";
import { Input } from "./input";
import { Toast } from "./toast";

// ponytail: vitest-axe's `toHaveNoViolations` matcher augments a `Vi` global
// namespace that vitest 4's types no longer expose, so `tsc --noEmit` fails
// on it. Asserting `.violations` directly (axe-core's own result shape)
// gives the identical check without the broken type augmentation — upgrade
// to the matcher if/when vitest-axe ships vitest-4-compatible types.
async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

/** AC-6: Button/Input/Badge/Card render with zero axe (WCAG 2.1 AA) violations. */
describe("test_storybook_components_render", () => {
  it("Button has no axe violations", async () => {
    const { container } = render(<Button>Save</Button>);
    await expectNoAxeViolations(container);
  });

  it("Input has no axe violations", async () => {
    const { container } = render(<Input aria-label="Tenant name" placeholder="Acme Corp" />);
    await expectNoAxeViolations(container);
  });

  it("Badge has no axe violations", async () => {
    const { container } = render(<Badge variant="success">Healthy</Badge>);
    await expectNoAxeViolations(container);
  });

  it("Card has no axe violations", async () => {
    const { container } = render(
      <Card>
        <CardTitle>Constitution Engine</CardTitle>
        <CardContent>The graph/ontology layer.</CardContent>
      </Card>
    );
    await expectNoAxeViolations(container);
  });

  it("Toast has no axe violations", async () => {
    const { container } = render(
      <Toast message="Couldn't save layout position." onDismiss={() => undefined} />
    );
    await expectNoAxeViolations(container);
  });
});
