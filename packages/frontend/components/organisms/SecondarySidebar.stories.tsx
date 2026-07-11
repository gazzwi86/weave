import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SecondarySidebar } from "./SecondarySidebar";

const GROUPS = [
  {
    heading: "Model",
    items: [
      { label: "Overview", href: "/ce/overview" },
      { label: "Explore", href: "/explorer" },
      { label: "Glossary", tag: "M2" },
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
