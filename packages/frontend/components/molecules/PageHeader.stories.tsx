import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PageHeader } from "./PageHeader";

const meta: Meta<typeof PageHeader> = {
  title: "Molecules/PageHeader",
  component: PageHeader,
};
export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: { title: "Ontology / Types", subtitle: "Every kind and relationship the graph knows about." },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
