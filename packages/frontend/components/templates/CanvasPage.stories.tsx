import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CanvasPage } from "./CanvasPage";

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
