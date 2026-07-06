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
