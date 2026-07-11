import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Toast } from "./toast";

const meta: Meta<typeof Toast> = {
  title: "Atoms/Toast",
  component: Toast,
};
export default meta;

type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  args: { message: "Couldn't save layout position. Retrying stopped.", onDismiss: () => undefined },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const SaveFailed: Story = {
  args: { message: "Couldn't save layout position. Retrying stopped.", onDismiss: () => undefined },
};
