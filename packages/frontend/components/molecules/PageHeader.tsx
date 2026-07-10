import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action slot (buttons), rendered as-is -- no business logic. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Page-level heading. `--text-h1` is the only token the title slot may
 * resolve to (F-D07: built app was rendering titles too small and too
 * light instead).
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-[var(--space-4)]", className)}>
      <div>
        <h1 className="text-[length:var(--text-h1)] font-[var(--font-weight-bold)] text-[var(--color-text-default)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-[var(--space-1)] text-[length:var(--text-body)] text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-[var(--space-2)]">{actions}</div> : null}
    </header>
  );
}
