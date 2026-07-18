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

/** Clamps a raw [start, start+span] segment to the [0, plateSpan] plate
 * bound, returning the clamped start and the span of the intersection (0
 * when the segment doesn't overlap the plate at all). */
function clampSegment(start: number, span: number, plateSpan: number): { start: number; span: number } {
  const end = start + span;
  const clampedStart = Math.min(Math.max(start, 0), plateSpan);
  const clampedEnd = Math.min(Math.max(end, 0), plateSpan);
  return { start: clampedStart, span: Math.max(0, clampedEnd - clampedStart) };
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
  const rawLeft = (viewportBBox.x1 - graphBBox.x1) * scaleX;
  const rawTop = (viewportBBox.y1 - graphBBox.y1) * scaleY;
  const rawWidth = (viewportBBox.x2 - viewportBBox.x1) * scaleX;
  const rawHeight = (viewportBBox.y2 - viewportBBox.y1) * scaleY;
  // Bug 6: the indicator must never be drawn off the minimap plate --
  // clamp to its intersection with [0, minimapSize] on each axis. A
  // viewport that doesn't overlap the plate at all clamps to a
  // zero-size rect pinned to the nearest edge, not a negative/oversized
  // rect hanging off the side.
  const x = clampSegment(rawLeft, rawWidth, minimapSize.width);
  const y = clampSegment(rawTop, rawHeight, minimapSize.height);
  return { left: x.start, top: y.start, width: x.span, height: y.span };
}
