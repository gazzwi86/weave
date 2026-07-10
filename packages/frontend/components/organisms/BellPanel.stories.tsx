import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { BellPanel } from "./BellPanel";

const meta: Meta<typeof BellPanel> = {
  title: "Organisms/BellPanel",
  component: BellPanel,
};
export default meta;

type Story = StoryObj<typeof BellPanel>;

export const Default: Story = {
  args: {
    notifications: [
      { id: "1", label: "Ontology published", read: false },
      { id: "2", label: "Budget cap reached", read: true },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Empty: Story = { args: { notifications: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };

// Coverage (TASK-026 retry): "Mark read" onClick handler was never exercised
// by any story -- static-args-only stories never trigger a real DOM click.
export const Interactive: Story = {
  args: {
    notifications: [{ id: "1", label: "Ontology published", read: false }],
    onMarkRead: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Mark read" }));
    expect(args.onMarkRead).toHaveBeenCalledWith("1");
  },
};
