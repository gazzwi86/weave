import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CanvasLegend } from "./CanvasLegend";

const meta: Meta<typeof CanvasLegend> = {
  title: "Molecules/CanvasLegend",
  component: CanvasLegend,
};
export default meta;

type Story = StoryObj<typeof CanvasLegend>;

export const Default: Story = {
  args: {
    entries: [
      { kind: "process", label: "Process" },
      { kind: "actor", label: "Actor" },
      { kind: "event", label: "Event" },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
