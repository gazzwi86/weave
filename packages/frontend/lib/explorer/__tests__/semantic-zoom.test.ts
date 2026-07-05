import { describe, expect, it, vi } from "vitest";

import { applySemanticZoom } from "../semantic-zoom";

function fakeCy(zoom: number) {
  return {
    zoom: () => zoom,
    nodes: vi.fn(() => ({ style: vi.fn() })),
    edges: vi.fn(() => ({ style: vi.fn() })),
  };
}

const THRESHOLDS = { nodeLabelThreshold: 0.3, edgeLabelThreshold: 0.55 };

describe("applySemanticZoom", () => {
  it("hides node labels when zoom drops below the node-label threshold (AC-6, config-driven)", () => {
    const cy = fakeCy(0.2);
    const nodesResult = { style: vi.fn() };
    cy.nodes.mockReturnValue(nodesResult);

    applySemanticZoom(cy, THRESHOLDS);

    expect(nodesResult.style).toHaveBeenCalledWith({ "text-opacity": 0 });
  });

  it("shows node labels when zoom is at/above the node-label threshold", () => {
    const cy = fakeCy(0.3);
    const nodesResult = { style: vi.fn() };
    cy.nodes.mockReturnValue(nodesResult);

    applySemanticZoom(cy, THRESHOLDS);

    expect(nodesResult.style).toHaveBeenCalledWith({ "text-opacity": 1 });
  });

  it("hides edge labels below the edge-label threshold independently of the node threshold", () => {
    const cy = fakeCy(0.4); // above node threshold, below edge threshold
    const nodesResult = { style: vi.fn() };
    const edgesResult = { style: vi.fn() };
    cy.nodes.mockReturnValue(nodesResult);
    cy.edges.mockReturnValue(edgesResult);

    applySemanticZoom(cy, THRESHOLDS);

    expect(nodesResult.style).toHaveBeenCalledWith({ "text-opacity": 1 });
    expect(edgesResult.style).toHaveBeenCalledWith({ "text-opacity": 0 });
  });
});
