import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Atoms/Badge",
  component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { variant: "neutral", children: "Draft" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Neutral: Story = { args: { variant: "neutral", children: "Draft" } };
export const Success: Story = { args: { variant: "success", children: "Healthy" } };
export const Warn: Story = { args: { variant: "warn", children: "Degraded" } };
export const Danger: Story = { args: { variant: "danger", children: "Failed" } };
