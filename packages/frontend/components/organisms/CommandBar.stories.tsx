import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CommandBar } from "./CommandBar";

const RESULTS = [
  { id: "wv:process-1", label: "Onboard customer" },
  { id: "wv:process-2", label: "Close invoice" },
];

const meta: Meta<typeof CommandBar> = {
  title: "Organisms/CommandBar",
  component: CommandBar,
};
export default meta;

type Story = StoryObj<typeof CommandBar>;

export const Default: Story = { args: { query: "onboard", results: RESULTS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { query: "onboard", results: [], loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
export const Empty: Story = { args: { query: "zzz", results: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };
