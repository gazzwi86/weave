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

  // QA edge case (zoom extreme): zoomed out past the graph's own extent, the
  // viewport bbox is *larger* than the graph bbox. computeViewportIndicator
  // has no clamping, so the indicator legitimately exceeds the minimap plate
  // (negative left/top, width/height > minimapSize) -- documents current,
  // unclamped behaviour so a future clamp change shows up as an intentional
  // diff here, not a silent regression.
  it("produces an unclamped indicator larger than the plate when zoomed out past the graph extent", () => {
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const viewportBBox = { x1: -50, y1: -25, x2: 250, y2: 125 };
    const minimapSize = { width: 100, height: 50 };

    const indicator = computeViewportIndicator(graphBBox, viewportBBox, minimapSize);

    expect(indicator.left).toBeLessThan(0);
    expect(indicator.top).toBeLessThan(0);
    expect(indicator.width).toBeGreaterThan(minimapSize.width);
    expect(indicator.height).toBeGreaterThan(minimapSize.height);
  });
});
