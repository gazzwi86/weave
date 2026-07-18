import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusPill } from "./status-pill";

const meta: Meta<typeof StatusPill> = {
  title: "Atoms/StatusPill",
  component: StatusPill,
};
export default meta;

type Story = StoryObj<typeof StatusPill>;

export const Default: Story = { args: { status: "active" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Active: Story = { args: { status: "active" } };
export const Published: Story = { args: { status: "published" } };
export const Draft: Story = { args: { status: "draft" } };
export const Custom: Story = { args: { status: "custom" } };
