import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ConfirmDialog } from "./confirm-dialog";

const meta: Meta<typeof ConfirmDialog> = {
  title: "Atoms/ConfirmDialog",
  component: ConfirmDialog,
};
export default meta;

type Story = StoryObj<typeof ConfirmDialog>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    open: true,
    entityType: "workspace",
    entityName: "Hammerbarn",
    consequence: "This can't be undone.",
    onCancel: noop,
    onConfirm: noop,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const LongConsequence: Story = {
  args: {
    open: true,
    entityType: "rule",
    entityName: "Data residency — EU only",
    consequence:
      "Three published policies and 42 entities currently reference this rule. Deleting it will leave those policies unenforced until a replacement rule is attached — the model stays valid, but the gaps show up in the next consistency check.",
    onCancel: noop,
    onConfirm: noop,
  },
};
