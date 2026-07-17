import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface KanbanCardProps {
  taskId: string;
  title: string;
  /** Extra badges beyond the mono task id -- e.g. an owner pill, a
   * `Badge variant="danger"`/`"warn"` retry/HITL chip. */
  chips?: ReactNode;
  /** Done-lane cards render dimmed (refit-mock.html `opacity:.7`). */
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
        dimmed && "opacity-70",
        className
      )}
    >
      <div className="mb-[var(--space-1)] font-[var(--font-weight-medium)] text-[var(--color-text-default)]">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-1)]">
        <span className="font-[family-name:var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {taskId}
        </span>
        {chips}
      </div>
    </div>
  );
}
