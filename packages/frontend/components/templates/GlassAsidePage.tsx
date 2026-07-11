import type { ReactNode } from "react";

import { GlassPanel } from "@/components/organisms/GlassPanel";

export interface GlassAsidePageProps {
  title: string;
  /** Right-aligned header action slot (e.g. "Clear history", AC-8). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Glass-elevated aside shell (`components.md` "Glass vs flat": an aside
 * overlay surface, so it uses `GlassPanel`) -- TASK-031 AC-8's chat aside.
 * Data-only props -- no chat state/fetch logic lives here. */
export function GlassAsidePage({ title, actions, children, className }: GlassAsidePageProps) {
  return (
    <GlassPanel className={className}>
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <p className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {title}
        </p>
        {actions}
      </div>
      <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">{children}</div>
    </GlassPanel>
  );
}
