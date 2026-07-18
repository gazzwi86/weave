import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface KanbanLaneProps {
  title: string;
  count: number;
  /** `KanbanCard` elements. */
  children: ReactNode;
  className?: string;
}

/** refit-mock.html `.kanban-lane` -- fixed-width flat lane with a title/count
 * header over a vertically scrolling stack of `KanbanCard`s. */
export function KanbanLane({ title, count, children, className }: KanbanLaneProps) {
  return (
    <div
      className={cn(
        "w-[var(--size-kanban-lane)] shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        "p-[var(--space-2)]",
        className
      )}
    >
      <h6 className="mb-[var(--space-2)] flex items-center justify-between text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase">
        <span>{title}</span>
        <span>{count}</span>
      </h6>
      <div
        data-testid="kanban-lane-cards"
        className="flex max-h-[var(--size-kanban-lane-max)] flex-col gap-[var(--space-2)] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}
