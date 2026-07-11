import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { OverlayLegendModel } from "@/lib/explorer/overlay-engine";
import type { NodeKind } from "@/lib/explorer/types";

import { CanvasLegend } from "./canvas-legend";
import { CompletenessNotice } from "./completeness-notice";
import { OverlayPanel } from "./overlay-panel";
import { SidePanel } from "./side-panel";
import type { OverlayToggle } from "./use-overlay-controls";

// ponytail: see components/ui/ui.a11y.test.tsx -- vitest-axe's matcher
// augmentation doesn't type-check under vitest 4, so violations are
// asserted directly off axe-core's own result shape.
async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

const PALETTE: NodeKind[] = [{ id: "process", label: "Process", colour: "var(--color-kind-process)" }];

const OVERLAY: OverlayLegendModel = {
  title: "Heatmap — maturity",
  entries: [
    { label: "High", colour: "var(--color-heat-5)" },
    { label: "Low", colour: "var(--color-heat-1)" },
  ],
  note: "1/3 nodes unmatched -- no maturity data",
};

const TOGGLES: OverlayToggle[] = [
  { id: "heatmap:maturity", label: "Heatmap: Maturity", active: true, disabled: false },
  { id: "domain-colouring", label: "Domain colouring", active: false, disabled: true },
];

// TASK-021 AC-7: colour is never the only carrier of meaning (WCAG 1.4.1)
// -- every legend swatch pairs its colour with a text label, and axe
// confirms the rendered DOM has zero violations with an overlay active.
describe("overlay a11y", () => {
  it("CanvasLegend with an active overlay legend has no axe violations", async () => {
    const { container } = render(<CanvasLegend palette={PALETTE} loading={false} overlay={OVERLAY} />);
    await expectNoAxeViolations(container);
  });

  it("OverlayPanel with a disabled sibling switch has no axe violations", async () => {
    const { container } = render(<OverlayPanel toggles={TOGGLES} onToggleOverlay={vi.fn()} />);
    await expectNoAxeViolations(container);
  });

  // TASK-027 AC-7: the gap badge is never colour-only -- its glyph+count
  // text equivalent lives in the panel's Missing links list, checked here.
  it("CompletenessNotice error state has no axe violations", async () => {
    const { container } = render(<CompletenessNotice notice={null} error={true} onRetry={vi.fn()} onDismiss={vi.fn()} />);
    await expectNoAxeViolations(container);
  });

  it("SidePanel with missing links has no axe violations", async () => {
    const { container } = render(
      <SidePanel
        state={{
          status: "loaded",
          label: "Customer Onboarding",
          typeLabel: "Process",
          keyProperties: [],
          rawIri: null,
          nodeId: "n1",
          neighbours: [],
          gaps: [{ missingLink: "https://weave.example/ontology/bpmo#performedBy", label: "performed by" }],
        }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    await expectNoAxeViolations(container);
  });
});
