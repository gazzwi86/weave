import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Toast, ToastProvider, useToast } from "./toast";

const meta: Meta<typeof Toast> = {
  title: "Atoms/Toast",
  component: Toast,
};
export default meta;

type Story = StoryObj<typeof Toast>;

const noop = () => undefined;

export const Default: Story = {
  args: { message: "Couldn't save layout position. Retrying stopped.", onDismiss: noop },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const SaveFailed: Story = {
  args: { message: "Couldn't save layout position. Retrying stopped.", onDismiss: noop },
};

export const Success: Story = { args: { message: "Layout saved.", onDismiss: noop, variant: "success" } };
export const ErrorVariant: Story = { args: { message: "Couldn't save layout position.", onDismiss: noop, variant: "error" } };
export const Info: Story = { args: { message: "Model tiers explained in Settings.", onDismiss: noop, variant: "info" } };

export const WithAction: Story = {
  args: {
    message: "Edit failed",
    onDismiss: noop,
    variant: "error",
    action: { label: "Retry", onClick: noop },
  },
};

/** Demonstrates ToastProvider/useToast stacking several toasts bottom-right. */
function StackingDemo() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toast({ message: "First toast", variant: "info" });
        toast({ message: "Second toast", variant: "success" });
        toast({ message: "Third toast", variant: "error" });
      }}
    >
      Fire three toasts
    </button>
  );
}

export const Stacking: Story = {
  render: () => (
    <ToastProvider>
      <StackingDemo />
    </ToastProvider>
  ),
};
