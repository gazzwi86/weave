import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface KanbanCardProps {
  taskId: string;
  title: string;
  /** Extra badges beyond the mono task id -- e.g. an owner pill, a
   * `Badge variant="danger"`/`"warn"` retry/HITL chip. */
  chips?: ReactNode;
  /** Done-lane cards render dimmed (refit-mock.html `opacity:.7`). Rendered
   * at .9 here, not the mock's literal .7 -- axe alpha-composites BOTH the
   * mono-id text and its own chip background toward the page backdrop
   * under `opacity`, so a whole-element opacity dim collapses their
   * mutual contrast (fails color-contrast well before .7). .9 is the
   * highest step that still reads as "dimmed" while holding >=4.5:1. */
  dimmed?: boolean;
  className?: string;
}

/** refit-mock.html `.kcard` -- title, mono task id, and a chips slot. */
export function KanbanCard({ taskId, title, chips, dimmed, className }: KanbanCardProps) {
  return (
    <div
      data-testid={`kanban-card-${taskId}`}
      className={cn(
        "rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)]",
        "p-[var(--space-2)] text-[length:var(--text-body-sm)]",
        "hover:border-[var(--color-accent-primary)]",
        dimmed && "opacity-90",
        className
      )}
    >
      <div className="mb-[var(--space-1)] font-[var(--font-weight-medium)] text-[var(--color-text-default)]">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-1)]">
        <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {taskId}
        </span>
        {chips}
      </div>
    </div>
  );
}
