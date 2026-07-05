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

// ponytail: stub -- red before green (TDD step 1).
export function computeViewportIndicator(
  _graphBBox: BoundingBox,
  _viewportBBox: BoundingBox,
  _minimapSize: { width: number; height: number },
): ViewportIndicator {
  throw new Error("not implemented");
}
