import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Toast } from "./toast";

const meta: Meta<typeof Toast> = {
  title: "UI/Toast",
  component: Toast,
};
export default meta;

type Story = StoryObj<typeof Toast>;

export const SaveFailed: Story = {
  args: { message: "Couldn't save layout position. Retrying stopped.", onDismiss: () => undefined },
};
