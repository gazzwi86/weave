import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { AppHeader } from "./AppHeader";

const meta: Meta<typeof AppHeader> = {
  title: "Organisms/AppHeader",
  component: AppHeader,
};
export default meta;

type Story = StoryObj<typeof AppHeader>;

export const Default: Story = {
  args: {
    breadcrumb: (
      <span>
        <b>Constitution</b> / Overview
      </span>
    ),
    tenantChip: <span>acme-co</span>,
    onOpenCommandBar: fn(),
    notifications: <span>🔔</span>,
    help: <span>?</span>,
    account: <span>PS</span>,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const CollapsedSidebar: Story = {
  args: { ...Default.args, sidebarCollapsed: true, onExpandSidebar: fn() },
};

export const WithNewAction: Story = {
  args: { ...Default.args, onNewAction: fn(), onNewMore: fn() },
};
