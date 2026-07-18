import { describe, expect, it, vi } from "vitest";

import { computeMinimapState, type CyExtentLike } from "../compute-minimap-state";

function fakeCy(graphBBox: { x1: number; y1: number; x2: number; y2: number }): CyExtentLike {
  return {
    elements: vi.fn(() => ({ boundingBox: () => graphBBox })),
    extent: vi.fn(() => graphBBox),
  };
}

const MINIMAP_SIZE = { width: 148, height: 88 };

describe("computeMinimapState", () => {
  it("scales the graph's node positions and viewport into minimap coordinates", () => {
    const cy = fakeCy({ x1: 0, y1: 0, x2: 200, y2: 100 });
    const adapter = {
      listNodes: vi.fn(() => [
        { id: "n1", label: "Onboarding", bpmoKind: "Process" },
        { id: "n2", label: "Widget", bpmoKind: "Unmapped" },
      ]),
      allNodePositions: vi.fn(() => ({ n1: { x: 0, y: 0 }, n2: { x: 200, y: 100 } })),
    };

    const { indicator, nodes } = computeMinimapState(cy, adapter as never, MINIMAP_SIZE);

    expect(indicator).toEqual({ left: 0, top: 0, width: 148, height: 88 });
    expect(nodes).toEqual([
      { id: "n1", x: 0, y: 0, colorVar: "--color-kind-process" },
      { id: "n2", x: 148, y: 88, colorVar: "--color-kind-fallback" },
    ]);
  });

  // AC-3: allNodePositions and listNodes can transiently disagree (a node
  // added to the adapter's list before its first layout position lands) --
  // drop it from the minimap rather than plotting a dot at (undefined, undefined).
  it("drops a listed node with no matching position instead of plotting NaN", () => {
    const cy = fakeCy({ x1: 0, y1: 0, x2: 100, y2: 100 });
    const adapter = {
      listNodes: vi.fn(() => [{ id: "n1", label: "Onboarding", bpmoKind: "Process" }]),
      allNodePositions: vi.fn(() => ({})),
    };

    const { nodes } = computeMinimapState(cy, adapter as never, MINIMAP_SIZE);

    expect(nodes).toEqual([]);
  });
});
