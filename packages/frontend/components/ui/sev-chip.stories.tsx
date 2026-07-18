import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SevChip } from "./sev-chip";

const meta: Meta<typeof SevChip> = {
  title: "Atoms/SevChip",
  component: SevChip,
};
export default meta;

type Story = StoryObj<typeof SevChip>;

export const Default: Story = { args: { severity: "warning" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Violation: Story = { args: { severity: "violation" } };
export const Warning: Story = { args: { severity: "warning" } };
export const Info: Story = { args: { severity: "info" } };
export const Critical: Story = { args: { severity: "critical" } };
export const Normal: Story = { args: { severity: "normal" } };
