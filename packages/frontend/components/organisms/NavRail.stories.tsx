import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NavRail } from "./NavRail";

const dot = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
  </svg>
);

const ITEMS = [
  { label: "Home", href: "/dashboard", icon: dot },
  { label: "Constitution", href: "/ce", icon: dot },
  { label: "Build", href: "/build", icon: dot },
];

const meta: Meta<typeof NavRail> = {
  title: "Organisms/NavRail",
  component: NavRail,
};
export default meta;

type Story = StoryObj<typeof NavRail>;

export const Default: Story = { args: { items: ITEMS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Selected: Story = { args: { items: ITEMS, activeHref: "/ce" } };
export const SelectedDark: Story = { ...Selected, parameters: { theme: "dark" } };
