import type { ViewportIndicator } from "@/lib/explorer/minimap-geometry";

// ponytail: no design-token entry covers a widget's own footprint (only
// colour/spacing/radius/shadow/motion are tokenised) -- 160x100 is a fixed
// functional plate size, not a decorative literal.
const PLATE_WIDTH = 160;
const PLATE_HEIGHT = 100;

/** AC-5: fixed bottom-right mini-map tracking the current viewport within
 * the full graph. `indicator` is `null` before the canvas has finished its
 * first load. */
export interface MiniMapProps {
  indicator: ViewportIndicator | null;
}

export function MiniMap({ indicator }: MiniMapProps) {
  return (
    <div
      data-testid="explorer-minimap"
      className="pointer-events-none absolute right-[var(--space-4)] bottom-[var(--space-4)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ width: PLATE_WIDTH, height: PLATE_HEIGHT }}
    >
      {indicator && (
        <div
          data-testid="explorer-minimap-viewport"
          className="absolute border border-[var(--color-accent-primary)]"
          style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }}
        />
      )}
    </div>
  );
}
