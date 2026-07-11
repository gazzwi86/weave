import type { WidgetOut } from "./types";
import { WidgetTile } from "./widget-tile";

/** AC-3: the bento dashboard grid (layout-grid.md). 12-col track at
 * `lg`+ with per-tile spans from `spec.column_span`; single column below
 * `lg` (the intermediate 2/3-col reclamp tiers aren't built -- ponytail:
 * add if a denser breakpoint step is actually requested).
 */
export function WidgetGrid({ widgets }: { widgets: WidgetOut[] }) {
  const ordered = [...widgets].sort((a, b) => a.position - b.position);

  return (
    <div className="grid w-full grid-cols-1 gap-[var(--space-6)] lg:grid-cols-12">
      {ordered.map((widget) => (
        <WidgetTile
          key={widget.id}
          widget={widget}
          style={{ gridColumn: `span ${widget.spec.column_span} / span 12` }}
        />
      ))}
    </div>
  );
}
