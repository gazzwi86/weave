import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UserMenu, type UserMenuItem } from "./UserMenu";

const ITEMS: UserMenuItem[] = [
  { icon: "user", label: "Profile & preferences", href: "/settings" },
  { icon: "swap", label: "Switch workspace", href: "/settings/workspaces" },
  { icon: "moon", label: "Theme", trailing: <span>Dark</span> },
  { icon: "logout", label: "Sign out", href: "/api/auth/signout", separatorBefore: true },
];

const meta: Meta<typeof UserMenu> = {
  title: "Organisms/UserMenu",
  component: UserMenu,
};
export default meta;

type Story = StoryObj<typeof UserMenu>;

export const Default: Story = {
  args: { name: "Priya Shah", email: "priya@hammerbarn.com.au", role: "workspace_admin", items: ITEMS },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
