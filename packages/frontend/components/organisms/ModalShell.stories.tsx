import * as Dialog from "@radix-ui/react-dialog";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModalShell } from "./ModalShell";

const meta: Meta<typeof ModalShell> = {
  title: "Organisms/ModalShell",
  component: ModalShell,
};
export default meta;

type Story = StoryObj<typeof ModalShell>;

const noop = () => undefined;

// ModalShell is deliberately title-agnostic (see ModalShell.tsx doc
// comment) -- every real consumer (ConfirmDialog, EntityPickerModal)
// supplies its own Dialog.Title, so these stories do too rather than
// giving the component an opinion it doesn't have (axe aria-dialog-name).
export const Default: Story = {
  args: {
    open: true,
    onClose: noop,
    children: (
      <>
        <Dialog.Title>Modal title</Dialog.Title>
        <p>Modal body (sm, 420px).</p>
      </>
    ),
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Md: Story = {
  ...Default,
  args: {
    ...Default.args,
    size: "md",
    children: (
      <>
        <Dialog.Title>Modal title</Dialog.Title>
        <p>Modal body (md, 440px).</p>
      </>
    ),
  },
};
export const Lg: Story = {
  ...Default,
  args: {
    ...Default.args,
    size: "lg",
    children: (
      <>
        <Dialog.Title>Modal title</Dialog.Title>
        <p>Modal body (lg, 460px).</p>
      </>
    ),
  },
};
