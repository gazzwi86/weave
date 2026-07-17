import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CanvasLegend } from "./CanvasLegend";

const meta: Meta<typeof CanvasLegend> = {
  title: "Molecules/CanvasLegend",
  component: CanvasLegend,
};
export default meta;

type Story = StoryObj<typeof CanvasLegend>;

const ENTRIES = [
  { kind: "process" as const, label: "Process" },
  { kind: "actor" as const, label: "Actor" },
  { kind: "event" as const, label: "Event" },
];

export const Default: Story = { args: { entries: ENTRIES } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const WithTools: Story = {
  args: {
    entries: ENTRIES,
    statusLabel: "12 kinds · published v14",
    zoomControls: (
      <>
        <button aria-label="Zoom in">+</button>
        <button aria-label="Zoom out">−</button>
        <button aria-label="Fit">⤢</button>
      </>
    ),
  },
};
export const WithToolsDark: Story = { ...WithTools, parameters: { theme: "dark" } };
