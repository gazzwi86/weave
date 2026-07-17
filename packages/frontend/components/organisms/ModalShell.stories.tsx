import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModalShell } from "./ModalShell";

const meta: Meta<typeof ModalShell> = {
  title: "Organisms/ModalShell",
  component: ModalShell,
};
export default meta;

type Story = StoryObj<typeof ModalShell>;

const noop = () => undefined;

export const Default: Story = {
  args: { open: true, onClose: noop, children: <p>Modal body (sm, 420px).</p> },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Md: Story = { ...Default, args: { ...Default.args, size: "md", children: <p>Modal body (md, 440px).</p> } };
export const Lg: Story = { ...Default, args: { ...Default.args, size: "lg", children: <p>Modal body (lg, 460px).</p> } };
