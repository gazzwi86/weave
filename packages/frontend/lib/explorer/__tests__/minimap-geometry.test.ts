import { describe, expect, it } from "vitest";

import { computeViewportIndicator } from "../minimap-geometry";

describe("computeViewportIndicator", () => {
  it("scales the current viewport extent into minimap pixel coordinates", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: 50, y1: 25, x2: 150, y2: 75 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator).toEqual({ left: 25, top: 12.5, width: 50, height: 25 });
  });

  it("does not divide by zero when the graph has no extent yet", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const viewportBBox = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(Number.isFinite(indicator.left)).toBe(true);
    expect(Number.isFinite(indicator.top)).toBe(true);
  });

  // Bug 6: zoomed out past the graph's own extent, the viewport bbox is
  // *larger* than the graph bbox. The indicator must clamp to the minimap
  // plate -- never drawn off it -- so this now asserts the clamped result
  // (the plate's full extent) instead of the old raw/overflowing one.
  it("clamps the indicator to the plate when zoomed out past the graph extent", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: -50, y1: -25, x2: 250, y2: 125 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator).toEqual({ left: 0, top: 0, width: 100, height: 50 });
  });

  // Bug 6: panned so the viewport sits entirely to the right of the graph
  // (e.g. dragged the canvas far past its content) -- the raw left would be
  // >= plate width. Must pin to the right edge with zero size, not draw a
  // rect starting off the plate.
  it("pins to the right/bottom edge with zero size when panned entirely past the graph extent", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: 250, y1: 150, x2: 300, y2: 200 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator).toEqual({ left: 100, top: 50, width: 0, height: 0 });
  });

  // Bug 6: panned so the viewport sits entirely to the left/above the graph
  // -- raw left/top are negative and raw right/bottom are also negative.
  // Must pin to the left/top edge with zero size, not draw a negative rect.
  it("pins to the left/top edge with zero size when panned entirely before the graph extent", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: -300, y1: -200, x2: -250, y2: -150 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });

  // Bug 6: partial overlap -- the viewport straddles the plate's right
  // edge. The indicator should shrink to the visible intersection, not
  // extend past the plate.
  it("shrinks width/height to the intersection when the viewport straddles a plate edge", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: 150, y1: 75, x2: 250, y2: 125 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator).toEqual({ left: 75, top: 37.5, width: 25, height: 12.5 });
  });
});
