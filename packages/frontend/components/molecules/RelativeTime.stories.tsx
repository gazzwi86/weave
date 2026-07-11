import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RelativeTime } from "./RelativeTime";

const meta: Meta<typeof RelativeTime> = {
  title: "Molecules/RelativeTime",
  component: RelativeTime,
};
export default meta;

type Story = StoryObj<typeof RelativeTime>;

export const Default: Story = { args: { iso: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
