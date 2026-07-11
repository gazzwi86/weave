import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppHeader } from "./AppHeader";

const meta: Meta<typeof AppHeader> = {
  title: "Organisms/AppHeader",
  component: AppHeader,
};
export default meta;

type Story = StoryObj<typeof AppHeader>;

export const Default: Story = {
  args: { left: <span>Weave</span>, right: <span>Ask</span> },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
