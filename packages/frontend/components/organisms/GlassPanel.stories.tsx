import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GlassPanel } from "./GlassPanel";

const meta: Meta<typeof GlassPanel> = {
  title: "Organisms/GlassPanel",
  component: GlassPanel,
};
export default meta;

type Story = StoryObj<typeof GlassPanel>;

export const Default: Story = { args: { children: "Command palette content" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
