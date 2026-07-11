import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-020 AC-1/AC-3/AC-4/AC-7: one adapter method owns the whole hide +
// dim + restore transaction for a filter-state change -- every mutation
// happens inside a single cy.batch() call (never per-node style loops),
// and the visibility/opacity sets it's given are absolute (not
// incremental): re-applying with a smaller hidden/dimmed set is how a
// toggle restores a previously hidden/dimmed node.
describe("createRendererAdapter -- TASK-020 applyFilterVisibility", () => {
  function setupNoOpNodesAndEdges(cy: ReturnType<typeof fakeCy>) {
    const visibleNodes = fakeCollection({
      filter: vi.fn(() => fakeCollection({ length: 0 })),
      not: vi.fn(() => fakeCollection({ length: 0 })),
    });
    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => fakeCollection({ length: 0 })), not: vi.fn(() => visibleNodes) }));
    cy.edges.mockReturnValue(fakeCollection());
    return visibleNodes;
  }

  it("hides the given node ids and their incident edges, and shows everything else (AC-1)", () => {
    const cy = fakeCy();
    const hiddenNodes = fakeCollection();
    const incidentEdges = fakeCollection();
    const visibleNodes = fakeCollection({ filter: vi.fn(() => fakeCollection({ length: 0 })), not: vi.fn(() => fakeCollection()) });
    const visibleEdges = fakeCollection();
    hiddenNodes.connectedEdges = vi.fn(() => incidentEdges);

    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => hiddenNodes), not: vi.fn(() => visibleNodes) }));
    // implementation calls cy.edges().filter() twice: explicit-hidden-by-id
    // first, then the visible-edges exclusion pass.
    cy.edges.mockReturnValue(fakeCollection({ filter: vi.fn().mockReturnValueOnce(fakeCollection()).mockReturnValueOnce(visibleEdges) }));

    createRendererAdapter(cy).applyFilterVisibility({ hiddenNodeIds: ["off1"], dimmedNodeIds: [] }, 0.18);

    expect(hiddenNodes.hide).toHaveBeenCalledTimes(1);
    expect(incidentEdges.hide).toHaveBeenCalledTimes(1);
    expect(visibleNodes.show).toHaveBeenCalledTimes(1);
    expect(visibleEdges.show).toHaveBeenCalledTimes(1);
  });

  it("dims the given visible node ids (opacity, not hide) and restores every other visible node to full opacity (AC-3)", () => {
    const cy = fakeCy();
    const dimmedNodes = fakeCollection();
    const restoredNodes = fakeCollection();
    const visibleNodes = fakeCollection({ filter: vi.fn(() => dimmedNodes), not: vi.fn(() => restoredNodes) });

    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => fakeCollection({ length: 0 })), not: vi.fn(() => visibleNodes) }));
    cy.edges.mockReturnValue(fakeCollection());

    createRendererAdapter(cy).applyFilterVisibility({ hiddenNodeIds: [], dimmedNodeIds: ["orphan1"] }, 0.18);

    expect(dimmedNodes.style).toHaveBeenCalledWith({ opacity: 0.18 });
    expect(restoredNodes.style).toHaveBeenCalledWith({ opacity: 1 });
  });

  it("batches every mutation into a single cy.batch() call -- no per-node style loop (AC-7)", () => {
    const cy = fakeCy();
    setupNoOpNodesAndEdges(cy);

    createRendererAdapter(cy).applyFilterVisibility({ hiddenNodeIds: [], dimmedNodeIds: [] }, 0.18);

    expect(cy.batch).toHaveBeenCalledTimes(1);
  });

  // AC-3: relationship-type toggle hides edges of a predicate directly --
  // those edges are not incident to any hidden node (both endpoint nodes
  // stay visible), so hiddenNodeIds alone can't reach them.
  it("hides edge ids given directly via hiddenEdgeIds, leaving their endpoint nodes visible (AC-3)", () => {
    const cy = fakeCy();
    const explicitHiddenEdges = fakeCollection();
    const visibleEdges = fakeCollection();
    const visibleNodes = fakeCollection({ filter: vi.fn(() => fakeCollection({ length: 0 })), not: vi.fn(() => fakeCollection()) });

    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => fakeCollection({ length: 0 })), not: vi.fn(() => visibleNodes) }));
    cy.edges.mockReturnValue(fakeCollection({ filter: vi.fn().mockReturnValueOnce(explicitHiddenEdges).mockReturnValueOnce(visibleEdges) }));

    createRendererAdapter(cy).applyFilterVisibility({ hiddenNodeIds: [], dimmedNodeIds: [], hiddenEdgeIds: ["s|pred|o"] }, 0.18);

    expect(explicitHiddenEdges.hide).toHaveBeenCalledTimes(1);
    expect(visibleEdges.show).toHaveBeenCalledTimes(1);
  });
});
