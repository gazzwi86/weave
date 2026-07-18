import type { MinimapNode } from "@/components/molecules/Minimap";
import { nodeKindColorVar } from "@/lib/explorer/canvas-legend-entries";
import {
  clampViewportIndicator,
  computeViewportIndicator,
  scaleNodesToMinimap,
  type BoundingBox,
  type ViewportIndicator,
} from "@/lib/explorer/minimap-geometry";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

/** Structural subset of `CyLike` this needs -- kept separate so this stays
 * testable without the rest of `use-explorer-canvas.ts`'s wiring. */
export interface CyExtentLike {
  elements(): { boundingBox(): BoundingBox };
  extent(): BoundingBox;
}

export interface MinimapState {
  indicator: ViewportIndicator;
  nodes: MinimapNode[];
}

// XT-008 sibling split: pulled out of wireCanvas (use-explorer-canvas.ts) to
// keep that hook under Law E's file-line budget. Node id/position/kind come
// from the adapter (RendererAdapter.listNodes/allNodePositions), not CyLike
// -- cy only supplies the graph's own bounding box + current viewport.
export function computeMinimapState(cy: CyExtentLike, adapter: RendererAdapter, minimapSize: { width: number; height: number }): MinimapState {
  const graphBBox = cy.elements().boundingBox();
  const indicator = clampViewportIndicator(computeViewportIndicator(graphBBox, cy.extent(), minimapSize), minimapSize);
  const positions = adapter.allNodePositions();
  const rawNodes = adapter.listNodes().flatMap(({ id, bpmoKind }) => {
    const position = positions[id];
    return position ? [{ id, x: position.x, y: position.y, colorVar: nodeKindColorVar(bpmoKind) }] : [];
  });
  return { indicator, nodes: scaleNodesToMinimap(rawNodes, graphBBox, minimapSize) };
}
