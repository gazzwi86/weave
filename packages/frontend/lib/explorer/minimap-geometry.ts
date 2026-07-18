/** AC-5: scale the current viewport's graph-space extent into minimap pixel
 * coordinates, so the minimap can draw a rectangle tracking what's visible. */
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ViewportIndicator {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeViewportIndicator(
  graphBBox: BoundingBox,
  viewportBBox: BoundingBox,
  minimapSize: { width: number; height: number },
): ViewportIndicator {
  const graphWidth = graphBBox.x2 - graphBBox.x1 || 1;
  const graphHeight = graphBBox.y2 - graphBBox.y1 || 1;
  const scaleX = minimapSize.width / graphWidth;
  const scaleY = minimapSize.height / graphHeight;
  return {
    left: (viewportBBox.x1 - graphBBox.x1) * scaleX,
    top: (viewportBBox.y1 - graphBBox.y1) * scaleY,
    width: (viewportBBox.x2 - viewportBBox.x1) * scaleX,
    height: (viewportBBox.y2 - viewportBBox.y1) * scaleY,
  };
}

/** Call-site clamp for `computeViewportIndicator`'s deliberately-unclamped
 * output (see that function's docstring + its own "zoomed out past the
 * graph extent" test) -- bounds the rect to the minimap's own plate so it
 * never visually spills outside the `Minimap` molecule's svg viewBox. */
export function clampViewportIndicator(
  indicator: ViewportIndicator,
  minimapSize: { width: number; height: number },
): ViewportIndicator {
  const left = Math.min(Math.max(indicator.left, 0), minimapSize.width);
  const top = Math.min(Math.max(indicator.top, 0), minimapSize.height);
  return {
    left,
    top,
    width: Math.min(Math.max(indicator.width, 0), minimapSize.width - left),
    height: Math.min(Math.max(indicator.height, 0), minimapSize.height - top),
  };
}

export interface MinimapNodePoint {
  id: string;
  x: number;
  y: number;
  colorVar: string;
}

/** Scales each node's graph-space position (`RendererAdapter.allNodePositions`)
 * into the minimap's coordinate space, the per-node counterpart of
 * `computeViewportIndicator` above -- same scale factors, so a dot and the
 * viewport rect agree on where "here" is. */
export function scaleNodesToMinimap(
  nodes: MinimapNodePoint[],
  graphBBox: BoundingBox,
  minimapSize: { width: number; height: number },
): MinimapNodePoint[] {
  const graphWidth = graphBBox.x2 - graphBBox.x1 || 1;
  const graphHeight = graphBBox.y2 - graphBBox.y1 || 1;
  const scaleX = minimapSize.width / graphWidth;
  const scaleY = minimapSize.height / graphHeight;
  return nodes.map((node) => ({
    ...node,
    x: (node.x - graphBBox.x1) * scaleX,
    y: (node.y - graphBBox.y1) * scaleY,
  }));
}
