import type { ReactNode } from "react";

export interface CanvasToolbarProps {
  children?: ReactNode;
}

// D-3/D-5: corner-docked top-left glass shell -- houses the search trigger
// (reused from the M1 Cmd-K spotlight overlay, wired in by the caller) and
// any future zoom/fit chrome. Presentation-only, same shell pattern as
// canvas-legend.tsx.
export function CanvasToolbar({ children }: CanvasToolbarProps) {
  return (
    <div
      data-testid="explorer-toolbar"
      className="absolute left-[var(--space-4)] top-[var(--space-4)] z-[var(--z-canvas-overlay)] flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-overlay)]/80 backdrop-blur-md p-[var(--space-2)] shadow-[var(--shadow-overlay)]"
    >
      {children}
    </div>
  );
}
