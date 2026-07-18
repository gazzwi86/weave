import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Gantt, type GanttRow } from "./Gantt";

const meta: Meta<typeof Gantt> = {
  title: "Molecules/Gantt",
  component: Gantt,
};
export default meta;

type Story = StoryObj<typeof Gantt>;

const SCALE = ["Jun 23", "Jun 30", "Jul 7", "Jul 14", "Jul 21", "Jul 28"];

const ROWS: GanttRow[] = [
  { id: "e1", label: "Epic 1 · Intake & RMA", status: "done", statusLabel: "done", startPct: 0, widthPct: 38 },
  { id: "e2", label: "Epic 2 · Approval flow", status: "active", statusLabel: "in progress", startPct: 30, widthPct: 42 },
  { id: "e3", label: "Epic 3 · Restock pipeline", status: "future", statusLabel: "up next", startPct: 64, widthPct: 34 },
];

export const Default: Story = { args: { scaleLabels: SCALE, rows: ROWS, todayPct: 62 } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
