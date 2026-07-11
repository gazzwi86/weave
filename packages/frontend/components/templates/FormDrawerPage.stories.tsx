import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormDrawerPage } from "./FormDrawerPage";

const meta: Meta<typeof FormDrawerPage> = {
  title: "Templates/FormDrawerPage",
  component: FormDrawerPage,
};
export default meta;

type Story = StoryObj<typeof FormDrawerPage>;

export const Default: Story = {
  args: {
    title: "Add customer",
    fields: <Input placeholder="Customer name" />,
    actions: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button>Save</Button>
      </>
    ),
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
