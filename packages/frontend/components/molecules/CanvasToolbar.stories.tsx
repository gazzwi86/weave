import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

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

// Coverage (TASK-026 retry): the tool button's onClick handler was never
// exercised by any story -- static-args-only stories never trigger a real
// DOM click. This drives real user interaction through the wired handler.
export const Interactive: Story = {
  args: { tools: TOOLS, onSelect: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Focus" }));
    expect(args.onSelect).toHaveBeenCalledWith("focus");
  },
};
