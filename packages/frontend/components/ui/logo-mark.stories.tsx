import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LogoMark } from "./logo-mark";

const meta: Meta<typeof LogoMark> = {
  title: "Atoms/LogoMark",
  component: LogoMark,
};
export default meta;

type Story = StoryObj<typeof LogoMark>;

export const Default: Story = { args: { size: 26 } };
export const Large: Story = { args: { size: 64 } };
export const TwoInstances: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <LogoMark size={26} />
      <LogoMark size={26} />
    </div>
  ),
};
