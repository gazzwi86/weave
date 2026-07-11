import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KindChip } from "./KindChip";

const meta: Meta<typeof KindChip> = {
  title: "Molecules/KindChip",
  component: KindChip,
};
export default meta;

type Story = StoryObj<typeof KindChip>;

export const Default: Story = { args: { kind: "process", label: "Process" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
