import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatCard } from "./stat-card";

const meta: Meta<typeof StatCard> = {
  title: "Atoms/StatCard",
  component: StatCard,
};
export default meta;

type Story = StoryObj<typeof StatCard>;

export const Default: Story = { args: { value: "14", label: "active brand rules" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Neutral: Story = { args: { value: "14", label: "active rules", tone: "neutral" } };
export const Ok: Story = { args: { value: "92%", label: "brand conformance", tone: "ok" } };
export const Bad: Story = { args: { value: "2", label: "violations", tone: "bad" } };
