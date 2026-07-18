import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FilterableTablePage } from "./FilterableTablePage";

const meta: Meta<typeof FilterableTablePage> = {
  title: "Templates/FilterableTablePage",
  component: FilterableTablePage,
};
export default meta;

type Story = StoryObj<typeof FilterableTablePage>;

export const Default: Story = {
  args: {
    filterBar: {
      chips: [
        { id: "framework", label: "Framework" },
        { id: "extensions", label: "Extensions" },
      ],
      activeIds: ["framework"],
      onToggle: () => {},
      search: { value: "", onChange: () => {}, label: "Search kinds", placeholder: "Search…" },
    },
    columns: [
      { key: "label", label: "Kind" },
      { key: "category", label: "Category" },
    ],
    rows: [
      { id: "process", cells: { label: "Process", category: "Framework" } },
      { id: "actor", cells: { label: "Actor", category: "Framework" } },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
