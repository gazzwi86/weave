import type { ViewportIndicator } from "@/lib/explorer/minimap-geometry";
import { cn } from "@/lib/utils";

export interface MinimapNode {
  id: string;
  /** Position already scaled to the minimap's own coordinate space (the
   * `viewBox`), not graph-canvas space. */
  x: number;
  y: number;
  colorVar: string;
}

export interface MinimapProps {
  nodes: MinimapNode[];
  /** Pre-computed by `computeViewportIndicator` -- unclamped by design (see
   * that module's docstring); this component only draws what it's given. */
  viewportRect: ViewportIndicator;
  /** Minimap coordinate-space size (the `viewBox`), not CSS pixels --
   * refit-mock.html's `#minimap` uses 148x88. */
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  className?: string;
}

/** refit-mock.html `.minimap`/`#minimap`/`.mm-view` -- a dot per node plus a
 * rect tracking the current viewport, over the graph canvas. */
export function Minimap({ nodes, viewportRect, viewBoxWidth = 148, viewBoxHeight = 88, className }: MinimapProps) {
  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Graph minimap"
    >
      {nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={2.4} fill={`var(${node.colorVar})`} />
      ))}
      <rect
        data-testid="explorer-minimap-viewport"
        x={viewportRect.left}
        y={viewportRect.top}
        width={viewportRect.width}
        height={viewportRect.height}
        rx={2}
        className="fill-[var(--color-accent-soft)] stroke-[var(--color-accent-primary)]"
        strokeWidth={1}
      />
    </svg>
  );
}
