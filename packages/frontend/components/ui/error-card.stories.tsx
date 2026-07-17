import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ErrorCard } from "./error-card";

const meta: Meta<typeof ErrorCard> = {
  title: "Atoms/ErrorCard",
  component: ErrorCard,
};
export default meta;

type Story = StoryObj<typeof ErrorCard>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    title: "Query timed out after 10 s",
    body: "The store may be busy. Try again.",
    onRetry: noop,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const NoRetry: Story = {
  args: {
    title: "Couldn't load this section",
    body: "No retry available for this failure — contact support if it persists.",
  },
};
