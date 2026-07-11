import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DashboardGrid } from "./DashboardGrid";

const meta: Meta<typeof DashboardGrid> = {
  title: "Templates/DashboardGrid",
  component: DashboardGrid,
};
export default meta;

type Story = StoryObj<typeof DashboardGrid>;

export const Default: Story = {
  args: {
    tiles: [
      { label: "Active workflows", value: "12" },
      { label: "Open tasks", value: "48" },
      { label: "Agents online", value: "3" },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
