import { describe, expect, it } from "vitest";

import { clampViewportIndicator, computeViewportIndicator, scaleNodesToMinimap } from "../minimap-geometry";

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

describe("clampViewportIndicator", () => {
  // computeViewportIndicator is intentionally unclamped (see above) -- this
  // is the call-site clamp so the rect Minimap draws never spills outside
  // its own plate at extreme zoom-out.
  it("bounds an indicator that overflows the plate back inside it", () => {
    const indicator = { left: -50, top: -25, width: 300, height: 150 };
    const minimapSize = { width: 100, height: 50 };

    expect(clampViewportIndicator(indicator, minimapSize)).toEqual({ left: 0, top: 0, width: 100, height: 50 });
  });

  it("leaves an already-in-bounds indicator untouched", () => {
    const indicator = { left: 10, top: 5, width: 20, height: 10 };
    const minimapSize = { width: 100, height: 50 };

    expect(clampViewportIndicator(indicator, minimapSize)).toEqual(indicator);
  });
});

describe("scaleNodesToMinimap", () => {
  it("scales each node's graph-space position into minimap coordinates, preserving id/colorVar", () => {
    const nodes = [
      { id: "n1", x: 0, y: 0, colorVar: "--color-kind-process" },
      { id: "n2", x: 200, y: 100, colorVar: "--color-kind-actor" },
    ];
    const graphBBox = { x1: 0, y1: 0, x2: 200, y2: 100 };
    const minimapSize = { width: 100, height: 50 };

    expect(scaleNodesToMinimap(nodes, graphBBox, minimapSize)).toEqual([
      { id: "n1", x: 0, y: 0, colorVar: "--color-kind-process" },
      { id: "n2", x: 100, y: 50, colorVar: "--color-kind-actor" },
    ]);
  });

  it("does not divide by zero when the graph has no extent yet", () => {
    const nodes = [{ id: "n1", x: 0, y: 0, colorVar: "--color-kind-process" }];
    const graphBBox = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const minimapSize = { width: 100, height: 50 };

    const [scaled] = scaleNodesToMinimap(nodes, graphBBox, minimapSize);
    expect(Number.isFinite(scaled?.x)).toBe(true);
    expect(Number.isFinite(scaled?.y)).toBe(true);
  });
});
