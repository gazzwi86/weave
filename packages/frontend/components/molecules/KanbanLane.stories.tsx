import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

import { KanbanCard } from "./KanbanCard";
import { KanbanLane } from "./KanbanLane";

const meta: Meta<typeof KanbanLane> = {
  title: "Molecules/KanbanLane",
  component: KanbanLane,
};
export default meta;

type Story = StoryObj<typeof KanbanLane>;

/** refit-mock.html board composition -- several lanes side by side. */
function Board() {
  return (
    <div className="flex gap-[var(--space-3)]">
      <KanbanLane title="Backlog" count={2}>
        <KanbanCard taskId="TASK-014" title="Email notifications on RMA" />
        <KanbanCard taskId="TASK-015" title="Restock exception report" />
      </KanbanLane>
      <KanbanLane title="In progress" count={2}>
        <KanbanCard taskId="TASK-012" title="Restock pipeline — API" chips={<Badge>engineer</Badge>} />
        <KanbanCard taskId="TASK-009" title="Refund calculation" chips={<Badge variant="danger">blocked</Badge>} />
      </KanbanLane>
      <KanbanLane title="QA" count={1}>
        <KanbanCard taskId="TASK-008" title="RMA approval flow" chips={<Badge variant="warn">your review</Badge>} />
      </KanbanLane>
      <KanbanLane title="Done" count={1}>
        <KanbanCard taskId="TASK-001" title="Intake form" dimmed />
      </KanbanLane>
    </div>
  );
}

export const Default: Story = { render: () => <Board /> };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
