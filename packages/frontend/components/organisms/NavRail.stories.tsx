import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NavRail } from "./NavRail";

const ITEMS = [
  { label: "Home", href: "/dashboard" },
  { label: "Constitution", href: "/ce" },
  { label: "Build", href: "/build" },
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
