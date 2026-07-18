import { StatCard } from "@/components/ui/stat-card";

import type { BoardResponse } from "./board/types";
import type { BudgetTilePayload } from "./dashboard-types";

function budgetValue(budget: BudgetTilePayload | null): string {
  return budget ? `$${Math.round(budget.total_estimate_usd)}` : "—";
}

function budgetLabel(budget: BudgetTilePayload | null): string {
  if (!budget) return "budget";
  return budget.cap_usd !== null ? `of $${budget.cap_usd} budget used` : "no cap configured";
}

/** G9 gap: no endpoint lists epics (count/status/dates) -- "epics created"
 * stays pending-state. The other four stats are real: tasks/done/blocked
 * are counted from the already-fetched board (Review/QA/In Progress/etc.
 * lane cards + the `status === "Blocked"` flag), budget from the existing
 * project-scoped `/dashboard/budget` tile.
 */
export function DashboardKpiRow({
  board,
  budget,
}: {
  board: BoardResponse | null;
  budget: BudgetTilePayload | null;
}): React.JSX.Element {
  const cards = board?.cards ?? [];
  const done = cards.filter((c) => c.lane === "Done").length;
  const blocked = cards.filter((c) => c.status === "Blocked").length;

  return (
    <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3 lg:grid-cols-5">
      <StatCard value="—" label="epics created" />
      <StatCard value={String(cards.length)} label="tasks created" />
      <StatCard value={String(done)} label="tasks done" tone="ok" />
      <StatCard value={String(blocked)} label="blocked — needs decision" tone="bad" />
      <StatCard value={budgetValue(budget)} label={budgetLabel(budget)} />
    </div>
  );
}
