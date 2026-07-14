import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Molecules/EmptyState",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    message: "No results found.",
    action: <Button variant="secondary">Retry</Button>,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
