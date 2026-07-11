import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { KpiTile } from "./KpiTile";

const meta: Meta<typeof KpiTile> = {
  title: "Molecules/KpiTile",
  component: KpiTile,
};
export default meta;

type Story = StoryObj<typeof KpiTile>;

export const Default: Story = { args: { label: "Entities", value: "1,204" } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { label: "Entities", loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
export const Empty: Story = { args: { label: "Entities", empty: true } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };
