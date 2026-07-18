import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SecondarySidebar } from "./SecondarySidebar";

const GROUPS = [
  {
    heading: "Model",
    items: [
      { label: "Overview", href: "/ce", icon: "home" as const },
      { label: "Explore", href: "/explorer", icon: "graph" as const },
      { label: "Strategy & motivation", tag: "soon", icon: "target" as const },
    ],
  },
];

const meta: Meta<typeof SecondarySidebar> = {
  title: "Organisms/SecondarySidebar",
  component: SecondarySidebar,
};
export default meta;

type Story = StoryObj<typeof SecondarySidebar>;

export const Default: Story = { args: { groups: GROUPS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Selected: Story = { args: { groups: GROUPS, activeHref: "/explorer" } };
export const SelectedDark: Story = { ...Selected, parameters: { theme: "dark" } };
export const WithHead: Story = {
  args: { groups: GROUPS, activeHref: "/explorer", title: "Constitution", onCollapse: () => {} },
};
export const WithHeadDark: Story = { ...WithHead, parameters: { theme: "dark" } };
export const Collapsed: Story = { args: { ...WithHead.args, collapsed: true } };
