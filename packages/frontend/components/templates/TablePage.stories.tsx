import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TablePage } from "./TablePage";

const meta: Meta<typeof TablePage> = {
  title: "Templates/TablePage",
  component: TablePage,
};
export default meta;

type Story = StoryObj<typeof TablePage>;

export const Default: Story = {
  args: {
    title: "Customers",
    subtitle: "12 records",
    columns: [
      { key: "name", label: "Name" },
      { key: "owner", label: "Owner" },
    ],
    rows: [{ id: "1", cells: { name: "Acme Co", owner: "Billing team" } }],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
