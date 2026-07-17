import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Pagination } from "./pagination";

const meta: Meta<typeof Pagination> = {
  title: "Atoms/Pagination",
  component: Pagination,
};
export default meta;

type Story = StoryObj<typeof Pagination>;

const noop = () => undefined;

export const Default: Story = {
  args: { page: 1, pageCount: 3, rangeLabel: "Showing 1–8 of 23", onPageChange: noop },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const FewPages: Story = {
  args: { page: 1, pageCount: 3, rangeLabel: "Showing 1–8 of 23", onPageChange: noop },
};

export const ManyPages: Story = {
  args: { page: 12, pageCount: 40, rangeLabel: "Showing 111–120 of 400", onPageChange: noop },
};
