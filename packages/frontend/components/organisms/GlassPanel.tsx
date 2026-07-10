import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

/**
 * The one glass-elevated surface (`components.md` "Glass vs flat"): glass is
 * reserved for modal/dialog/popover/command-palette/canvas-overlay only --
 * `KpiTile` and `DataTable` stay flat. `--shadow-overlay` + `backdrop-filter`
 * blur, nothing else.
 */
export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)]",
        "p-[var(--space-5)] shadow-[var(--shadow-overlay)] backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}
