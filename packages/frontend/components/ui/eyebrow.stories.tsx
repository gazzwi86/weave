import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Eyebrow } from "./eyebrow";

const meta: Meta<typeof Eyebrow> = {
  title: "Atoms/Eyebrow",
  component: Eyebrow,
};
export default meta;

type Story = StoryObj<typeof Eyebrow>;

export const Default: Story = { args: { tone: "muted", children: "Needs you" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Muted: Story = { args: { tone: "muted", children: "Needs you" } };
export const Accent: Story = { args: { tone: "accent", children: "Home" } };
