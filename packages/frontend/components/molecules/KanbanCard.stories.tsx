import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

import { KanbanCard } from "./KanbanCard";

const meta: Meta<typeof KanbanCard> = {
  title: "Molecules/KanbanCard",
  component: KanbanCard,
};
export default meta;

type Story = StoryObj<typeof KanbanCard>;

export const Default: Story = {
  args: { taskId: "TASK-012", title: "Restock pipeline — API", chips: <Badge>engineer</Badge> },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

// Extra variant showcase (not part of the closed AC-4 state set).
export const Dimmed: Story = {
  args: { taskId: "TASK-001", title: "Intake form", dimmed: true },
};
export const DimmedDark: Story = { ...Dimmed, parameters: { theme: "dark" } };
