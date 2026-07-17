import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SearchInput } from "./search-input";

const meta: Meta<typeof SearchInput> = {
  title: "Atoms/SearchInput",
  component: SearchInput,
};
export default meta;

type Story = StoryObj<typeof SearchInput>;

const noop = () => {};

export const Default: Story = { args: { value: "", placeholder: "Search entities", onChange: noop } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Focused: Story = {
  args: { value: "", placeholder: "Search entities", onChange: noop },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("input")?.focus();
  },
};

export const WithValue: Story = {
  render: (args) => {
    function Wrapped() {
      const [value, setValue] = useState("customer onboarding");
      return <SearchInput {...args} value={value} onChange={setValue} />;
    }
    return <Wrapped />;
  },
  args: { value: "", placeholder: "Search entities", onChange: noop },
};
