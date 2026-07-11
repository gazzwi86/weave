import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InspectorPanel } from "./InspectorPanel";

const TITLE = "Onboard customer";
const FIELDS = [
  { label: "Kind", value: "Process" },
  { label: "Owner", value: "Billing team" },
];

const meta: Meta<typeof InspectorPanel> = {
  title: "Organisms/InspectorPanel",
  component: InspectorPanel,
};
export default meta;

type Story = StoryObj<typeof InspectorPanel>;

export const Default: Story = { args: { title: TITLE, fields: FIELDS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { title: TITLE, fields: [], loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
export const Empty: Story = { args: { title: TITLE, fields: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };
