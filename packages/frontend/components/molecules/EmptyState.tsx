import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  message: string;
  /** Optional action slot (e.g. a retry/create Button) -- rendered as-is. */
  action?: ReactNode;
  className?: string;
}

/** Generic "nothing here" placeholder -- used wherever a list/panel/canvas
 * has no data instead of leaving a blank surface. */
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-[var(--space-4)] p-[var(--space-6)] text-center",
        className
      )}
    >
      <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">{message}</p>
      {action}
    </div>
  );
}
