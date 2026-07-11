import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

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

// AC-2: breadcrumb trail + the single primary/secondary/ghost button rule --
// one bright primary CTA, never two.
export const WithBreadcrumbAndActions: Story = {
  args: {
    title: "Instances / Data",
    breadcrumb: [
      { label: "Workspace", href: "/dashboard" },
      { label: "Constitution", href: "/ce" },
      { label: "Instances / Data" },
    ],
    actions: (
      <>
        <Button variant="ghost">Export</Button>
        <Button variant="secondary">Filter</Button>
        <Button variant="primary">New instance</Button>
      </>
    ),
  },
};
export const WithBreadcrumbAndActionsDark: Story = { ...WithBreadcrumbAndActions, parameters: { theme: "dark" } };
