import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AskBar } from "./AskBar";

const meta: Meta<typeof AskBar> = {
  title: "Molecules/AskBar",
  component: AskBar,
};
export default meta;

type Story = StoryObj<typeof AskBar>;

export const Default: Story = { args: {} };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { value: "How many processes reference Billing?", loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
