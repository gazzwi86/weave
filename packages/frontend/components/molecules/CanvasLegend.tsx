import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { KindChip, type BpmoKind } from "./KindChip";

export interface CanvasLegendEntry {
  kind: BpmoKind;
  label: string;
}

export interface CanvasLegendProps {
  entries: CanvasLegendEntry[];
  /** refit-mock.html `.legend .tools` left-hand text, e.g. "12 kinds ·
   * published v14" -- the tools row only renders when this is given. */
  statusLabel?: string;
  /** refit-mock.html `.legend .zoom` button group -- a slot rather than a
   * built-in zoom control, since zoom state/handlers live with the canvas. */
  zoomControls?: ReactNode;
  className?: string;
}

/** refit-mock.html `.legend` -- kind swatches (via `KindChip`, whose glyph
 * per kind already pairs shape with colour -- WCAG 1.4.1 -- richer than the
 * mock's 3-way circle/diamond/square dot, so reused as-is rather than adding
 * a second, cruder shape system) + an optional tools row underneath. */
export function CanvasLegend({ entries, statusLabel, zoomControls, className }: CanvasLegendProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--space-2)]", className)}>
      <ul className="flex flex-wrap gap-[var(--space-2)]">
        {entries.map((entry) => (
          <li key={entry.kind}>
            <KindChip kind={entry.kind} label={entry.label} />
          </li>
        ))}
      </ul>
      {statusLabel && (
        <div className="flex items-center justify-between gap-[var(--space-2)] border-t border-[var(--color-border)] pt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          <span>{statusLabel}</span>
          {zoomControls && <div className="flex gap-[var(--space-1)]">{zoomControls}</div>}
        </div>
      )}
    </div>
  );
}
