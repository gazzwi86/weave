import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KindChip, type BpmoKind } from "@/components/molecules/KindChip";

import { CanvasPage } from "./CanvasPage";

// TASK-028: real graph-canvas nodes (KindChip, real tokens/colours) for a
// marketing-screenshot capture -- not a data fixture, just enough scatter to
// read as a live graph. See tests/e2e/_capture-marketing-screenshots.spec.ts.
const SCREENSHOT_NODES: Array<{ kind: BpmoKind; label: string; top: string; left: string }> = [
  { kind: "process", label: "Onboard customer", top: "20%", left: "15%" },
  { kind: "actor", label: "Support team", top: "55%", left: "10%" },
  { kind: "system", label: "Billing API", top: "30%", left: "55%" },
  { kind: "dataasset", label: "Customer record", top: "65%", left: "60%" },
  { kind: "process", label: "Renew contract", top: "15%", left: "75%" },
];

function MarketingGraphCanvas() {
  return (
    <div className="relative h-full w-full bg-[var(--color-surface)]">
      {SCREENSHOT_NODES.map((node) => (
        <div key={node.label} className="absolute" style={{ top: node.top, left: node.left }}>
          <KindChip kind={node.kind} label={node.label} />
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof CanvasPage> = {
  title: "Templates/CanvasPage",
  component: CanvasPage,
};
export default meta;

type Story = StoryObj<typeof CanvasPage>;

export const Default: Story = {
  args: {
    tools: [
      { id: "select", label: "Select" },
      { id: "pan", label: "Pan" },
    ],
    activeToolId: "select",
    legend: [
      { kind: "process", label: "Process" },
      { kind: "actor", label: "Actor" },
    ],
    inspectorTitle: "Onboard customer",
    inspectorFields: [{ label: "Kind", value: "Process" }],
    canvas: <div className="h-full w-full bg-[var(--color-surface)]" />,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

// TASK-028 AC-1: capture target for the marketing hero screenshot -- real
// graph-canvas surface (KindChip nodes, real tokens), not the old
// MockGraphPanel CSS dots.
export const MarketingScreenshot: Story = {
  args: { ...Default.args, canvas: <MarketingGraphCanvas /> },
};
