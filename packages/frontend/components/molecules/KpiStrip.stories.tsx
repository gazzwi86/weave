import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KpiStrip } from "./KpiStrip";

const meta: Meta<typeof KpiStrip> = {
  title: "Molecules/KpiStrip",
  component: KpiStrip,
};
export default meta;

type Story = StoryObj<typeof KpiStrip>;

export const Default: Story = {
  args: {
    items: [
      { value: "1,240", label: "entities" },
      { value: "3,482", label: "relations" },
      { value: "0", label: "violations", variant: "ok" },
      { value: "v14", label: "published" },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
