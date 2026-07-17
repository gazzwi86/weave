import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModalShell } from "./ModalShell";

const meta: Meta<typeof ModalShell> = {
  title: "Organisms/ModalShell",
  component: ModalShell,
};
export default meta;

type Story = StoryObj<typeof ModalShell>;

const noop = () => undefined;

export const Sm: Story = {
  args: { open: true, onClose: noop, children: <p>Modal body (sm, 420px).</p> },
};
export const SmDark: Story = { ...Sm, parameters: { theme: "dark" } };

export const Md: Story = { ...Sm, args: { ...Sm.args, size: "md", children: <p>Modal body (md, 440px).</p> } };
export const Lg: Story = { ...Sm, args: { ...Sm.args, size: "lg", children: <p>Modal body (lg, 460px).</p> } };
