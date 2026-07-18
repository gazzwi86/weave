import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UserMenu, type UserMenuItem } from "./UserMenu";

const ITEMS: UserMenuItem[] = [
  { icon: "user", label: "Profile & preferences", href: "/settings" },
  { icon: "swap", label: "Switch workspace", href: "/settings/workspaces" },
  { icon: "moon", label: "Theme", trailing: <span>Dark</span> },
  { icon: "logout", label: "Sign out", href: "/api/auth/signout", separatorBefore: true },
];

// V5: refit-mock.html's "Operator console — provision companies" entry,
// shown only to platform operators (avatar-menu.tsx's isPlatformOperator
// gate) -- mirrors the two role states that component renders.
const ITEMS_WITH_OPERATOR: UserMenuItem[] = [
  { icon: "shield", label: "Operator console — provision companies", href: "/operator" },
  { ...ITEMS[0]!, separatorBefore: true },
  ...ITEMS.slice(1),
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

export const SuperAdmin: Story = {
  args: { name: "Priya Shah", email: "priya@hammerbarn.com.au", role: "admin", items: ITEMS_WITH_OPERATOR },
};
