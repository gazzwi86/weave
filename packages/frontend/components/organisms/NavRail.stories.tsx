import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Icon } from "@/components/ui/icon";

import { NavRail } from "./NavRail";

const ITEMS = [
  { label: "Home", href: "/dashboard", icon: <Icon name="home" size={20} /> },
  { label: "Constitution", href: "/ce", icon: <Icon name="graph" size={20} /> },
  { label: "Build", href: "/build", icon: <Icon name="layers" size={20} /> },
];

// Events isn't built yet -- renders dimmed with a coming-soon tooltip
// instead of a link (feedback_no_phase_pills.md).
const ITEMS_WITH_DISABLED = [
  ...ITEMS,
  { label: "Events", href: "/events", icon: <Icon name="zap" size={20} />, disabled: true },
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
export const WithDisabledItem: Story = { args: { items: ITEMS_WITH_DISABLED, activeHref: "/ce" } };
