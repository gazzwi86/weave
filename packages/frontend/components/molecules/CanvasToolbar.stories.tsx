import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CanvasToolbar } from "./CanvasToolbar";

const TOOLS = [
  { id: "pan", label: "Pan" },
  { id: "select", label: "Select" },
  { id: "focus", label: "Focus" },
];

const meta: Meta<typeof CanvasToolbar> = {
  title: "Molecules/CanvasToolbar",
  component: CanvasToolbar,
};
export default meta;

type Story = StoryObj<typeof CanvasToolbar>;

export const Default: Story = { args: { tools: TOOLS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Selected: Story = { args: { tools: TOOLS, activeToolId: "select" } };
export const SelectedDark: Story = { ...Selected, parameters: { theme: "dark" } };
