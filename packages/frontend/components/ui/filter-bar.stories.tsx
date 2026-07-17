import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { FilterBar, type FilterChip } from "./filter-bar";

const meta: Meta<typeof FilterBar> = {
  title: "Molecules/FilterBar",
  component: FilterBar,
};
export default meta;

type Story = StoryObj<typeof FilterBar>;

const noop = () => undefined;

const CHIPS: FilterChip[] = [
  { id: "all", label: "All", color: "var(--color-accent-primary)" },
  { id: "process", label: "Framework", color: "var(--color-kind-process)" },
  { id: "domain", label: "Extensions", color: "var(--color-kind-businessdomain)" },
  { id: "relationships", label: "Relationships" },
];

export const Default: Story = { args: { chips: CHIPS, activeIds: ["all"], onToggle: noop } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const ChipsOnly: Story = { args: { chips: CHIPS, activeIds: ["all"], onToggle: noop } };

export const WithSearch: Story = {
  render: (args) => {
    function Wrapped() {
      const [value, setValue] = useState("");
      return <FilterBar {...args} search={{ value, onChange: setValue, placeholder: "Search kinds & relationship types…" }} />;
    }
    return <Wrapped />;
  },
  args: { chips: CHIPS, activeIds: ["all"], onToggle: noop },
};

export const WithTrailing: Story = {
  args: {
    chips: CHIPS,
    activeIds: ["all", "process"],
    onToggle: noop,
    trailing: <span className="text-[length:var(--text-label)] text-[var(--color-text-subtle)]">Sort: instance count</span>,
  },
};
