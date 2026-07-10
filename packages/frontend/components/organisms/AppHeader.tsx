import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  /** Left slot -- typically workspace switcher + primary nav. */
  left: ReactNode;
  /** Right slot -- typically ask bar + notification bell + user menu. */
  right?: ReactNode;
  className?: string;
}

/** Sticky top chrome bar (`components.md` "Navigation & tabs": `--z-sticky`,
 * `--color-raised`, `--shadow-1` on scroll). */
export function AppHeader({ left, right, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-sticky)] flex items-center justify-between gap-[var(--space-4)]",
        "border-b border-[var(--color-border)] bg-[var(--color-raised)] px-[var(--space-4)] py-[var(--space-2)]",
        className
      )}
    >
      <div className="flex items-center gap-[var(--space-4)]">{left}</div>
      {right ? <div className="flex items-center gap-[var(--space-2)]">{right}</div> : null}
    </header>
  );
}
