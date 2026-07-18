import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InfoTip } from "./info-tip";

const meta: Meta<typeof InfoTip> = {
  title: "Atoms/InfoTip",
  component: InfoTip,
};
export default meta;

type Story = StoryObj<typeof InfoTip>;

const args = {
  title: "Brand conformance",
  body: "Share of generated content passing brand rules.",
};

export const Default: Story = { args };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const WithHow: Story = {
  args: { ...args, how: "Computed nightly from the audit log." },
};

export const Left: Story = { args: { ...args, side: "left" } };

export const Up: Story = { args: { ...args, direction: "up" } };

export const Long: Story = {
  args: {
    title: "Model tiers",
    body: "Two tiers balance quality and cost: a high tier for judgement work (planning, architecture, review) and a mid tier for volume work (writing code, tests and documents).",
    how: "Tier assignment is fixed per task type, not chosen at runtime.",
  },
};
