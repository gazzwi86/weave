import { describe, expect, it, vi } from "vitest";

import { applySemanticZoom } from "../semantic-zoom";

function fakeCy(zoom: number) {
  return {
    zoom: () => zoom,
    nodes: vi.fn(() => ({ style: vi.fn() })),
    edges: vi.fn(() => ({ style: vi.fn() })),
  };
}

const THRESHOLDS = { nodeLabelThreshold: 0.3, edgeLabelThreshold: 0.55, alwaysLabelledKinds: [] };

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

// V3b-2 item 1: de-hairball label-thinning -- orienting nodes (domain/
// process kinds) stay labelled even when zoomed out past nodeLabelThreshold,
// so a dense hundreds-of-node canvas still has legible landmarks at a glance.
describe("applySemanticZoom -- always-labelled kinds", () => {
  it("keeps labels on always-labelled kinds even below the zoom threshold", () => {
    const cy = fakeCy(0.1); // well below nodeLabelThreshold
    const restResult = { style: vi.fn() };
    const importantResult = { style: vi.fn() };
    cy.nodes.mockImplementation((selector?: string) => (selector ? importantResult : restResult));

    applySemanticZoom(cy, { ...THRESHOLDS, alwaysLabelledKinds: ["BusinessDomain", "Process"] });

    expect(restResult.style).toHaveBeenCalledWith({ "text-opacity": 0 });
    expect(importantResult.style).toHaveBeenCalledWith({ "text-opacity": 1 });
    expect(cy.nodes).toHaveBeenCalledWith('[bpmo_kind = "BusinessDomain"], [bpmo_kind = "Process"]');
  });

  it("does not query for important nodes when alwaysLabelledKinds is empty", () => {
    const cy = fakeCy(0.1);
    const nodesResult = { style: vi.fn() };
    cy.nodes.mockReturnValue(nodesResult);

    applySemanticZoom(cy, THRESHOLDS);

    expect(cy.nodes).toHaveBeenCalledTimes(1);
  });
});
