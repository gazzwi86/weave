import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Atoms/Input",
  component: Input,
  argTypes: {
    "aria-label": { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Enter tenant name", "aria-label": "Tenant name" },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Error: Story = {
  args: { placeholder: "Enter tenant name", "aria-label": "Tenant name", error: true },
};
export const ErrorDark: Story = { ...Error, parameters: { theme: "dark" } };

export const Disabled: Story = {
  args: { placeholder: "Read only", disabled: true, "aria-label": "Read only field" },
};
