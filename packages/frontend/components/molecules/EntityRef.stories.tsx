import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EntityRef } from "./EntityRef";

const meta: Meta<typeof EntityRef> = {
  title: "Molecules/EntityRef",
  component: EntityRef,
};
export default meta;

type Story = StoryObj<typeof EntityRef>;

export const Default: Story = { args: { label: "Onboard customer", id: "wv:process-0142" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
