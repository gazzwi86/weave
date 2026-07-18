import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ChainStatusChip } from "./chain-status-chip";

const meta: Meta<typeof ChainStatusChip> = {
  title: "Atoms/ChainStatusChip",
  component: ChainStatusChip,
};
export default meta;

type Story = StoryObj<typeof ChainStatusChip>;

export const Default: Story = { args: { status: "valid", href: "/audit/compliance" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Valid: Story = { args: { status: "valid", href: "/audit/compliance" } };
export const Broken: Story = { args: { status: "broken", href: "/audit/compliance" } };
