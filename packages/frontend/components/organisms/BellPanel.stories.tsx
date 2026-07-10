import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BellPanel } from "./BellPanel";

const meta: Meta<typeof BellPanel> = {
  title: "Organisms/BellPanel",
  component: BellPanel,
};
export default meta;

type Story = StoryObj<typeof BellPanel>;

export const Default: Story = {
  args: {
    notifications: [
      { id: "1", label: "Ontology published", read: false },
      { id: "2", label: "Budget cap reached", read: true },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Empty: Story = { args: { notifications: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };
