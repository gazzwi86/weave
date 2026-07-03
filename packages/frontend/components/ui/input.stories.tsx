import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
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

export const Disabled: Story = {
  args: { placeholder: "Read only", disabled: true, "aria-label": "Read only field" },
};
