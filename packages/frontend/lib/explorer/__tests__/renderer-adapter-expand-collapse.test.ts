import { describe, expect, it, vi } from "vitest";

import { EXPLORER_HIGHLIGHT_CLASS } from "../build-stylesheet";
import { createRendererAdapter, type CyCollection, type NeighbourElement } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-005 AC-3/AC-5: neighbour expand/collapse operations, added to the
// same ADR-001 seam.
describe("createRendererAdapter -- TASK-005 expand/collapse additions", () => {
  const NEW_NEIGHBOUR: NeighbourElement = {
    iri: "https://weave.example/entity/new-1",
    label: "New Neighbour",
    bpmoKind: "Process",
    edgePredicate: "https://weave.example/ontology/bpmo#relatesTo",
    edgeDirection: "outgoing",
  };

  it("expandNode() attaches only newly-discovered nodes/edges and records the added ids on the focus node", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({ length: 1, data: vi.fn() });
    cy.getElementById.mockImplementation((id: string) =>
      id === "focus" ? focusNode : fakeCollection({ length: 0 })
    );

    const added = createRendererAdapter(cy).expandNode("focus", [NEW_NEIGHBOUR]);

    expect(added).toEqual([NEW_NEIGHBOUR.iri]);
    expect(cy.add).toHaveBeenCalledWith([
      { data: { id: NEW_NEIGHBOUR.iri, label: NEW_NEIGHBOUR.label, bpmo_kind: NEW_NEIGHBOUR.bpmoKind } },
      {
        data: {
          id: `focus|${NEW_NEIGHBOUR.edgePredicate}|${NEW_NEIGHBOUR.iri}`,
          source: "focus",
          target: NEW_NEIGHBOUR.iri,
          label: NEW_NEIGHBOUR.edgePredicate,
        },
      },
    ]);
    expect(focusNode.data).toHaveBeenCalledWith("expandedNeighbourIds", [NEW_NEIGHBOUR.iri]);
  });

  it("expandNode() highlights (not duplicates) a neighbour already on the canvas", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({ length: 1, data: vi.fn() });
    const existingNeighbour = fakeCollection({ length: 1 });
    cy.getElementById.mockImplementation((id: string) => {
      if (id === "focus") return focusNode;
      if (id === NEW_NEIGHBOUR.iri) return existingNeighbour;
      return fakeCollection({ length: 0 });
    });

    const added = createRendererAdapter(cy).expandNode("focus", [NEW_NEIGHBOUR]);

    expect(added).toEqual([]);
    expect(cy.add).not.toHaveBeenCalled();
    expect(existingNeighbour.addClass).toHaveBeenCalledWith(EXPLORER_HIGHLIGHT_CLASS);
  });

  it("expandNode() returns an empty list and touches nothing for an unknown focus node", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    const added = createRendererAdapter(cy).expandNode("missing", [NEW_NEIGHBOUR]);

    expect(added).toEqual([]);
    expect(cy.add).not.toHaveBeenCalled();
  });

  it("collapseNode() removes added neighbours with no other retained connection and keeps the focus node", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({
      length: 1,
      id: vi.fn(() => "focus"),
      data: vi.fn((key: string) => (key === "expandedNeighbourIds" ? ["a"] : undefined)),
    });
    const removableCollection = fakeCollection();
    cy.getElementById.mockReturnValue(focusNode);
    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => removableCollection) }));

    createRendererAdapter(cy).collapseNode("focus");

    expect(cy.remove).toHaveBeenCalledWith(removableCollection);
    expect(focusNode.data).toHaveBeenCalledWith("expandedNeighbourIds", undefined);
  });

  it("collapseNode() keeps a node that has a retained connection to something outside the removed set", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({
      length: 1,
      id: vi.fn(() => "focus"),
      data: vi.fn((key: string) => (key === "expandedNeighbourIds" ? ["a"] : undefined)),
    });
    const edgeToOutsider = fakeCollection({ data: vi.fn((key: string) => ({ source: "a", target: "outsider" })[key]) });
    const nodeA = fakeCollection({
      id: vi.fn(() => "a"),
      connectedEdges: vi.fn(() => fakeCollection({ length: 1, map: vi.fn((fn) => [fn(edgeToOutsider)]) })),
    });
    cy.getElementById.mockReturnValue(focusNode);
    let filterFn: ((ele: CyCollection) => boolean) | undefined;
    cy.nodes.mockReturnValue(
      fakeCollection({
        filter: vi.fn((fn: (ele: CyCollection) => boolean) => {
          filterFn = fn;
          return fakeCollection();
        }),
      })
    );

    createRendererAdapter(cy).collapseNode("focus");

    expect(filterFn?.(nodeA)).toBe(false); // has a retained connection to "outsider" -- not removable
  });

  it("collapseNode() is a no-op when the node has no recorded expansion", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({ length: 1, data: vi.fn(() => undefined) });
    cy.getElementById.mockReturnValue(focusNode);

    createRendererAdapter(cy).collapseNode("focus");

    expect(cy.remove).not.toHaveBeenCalled();
  });

  // AC-5: the context menu needs to know whether to offer "Expand" or
  // "Collapse" -- this reads the same expandedNeighbourIds data expandNode
  // wrote, so it survives across remounts of any consuming hook/component.
  it("hasExpandedNeighbours() is true only after a non-empty expandNode() and false after collapseNode()", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({
      length: 1,
      id: vi.fn(() => "focus"),
      data: vi.fn((key: string) => (key === "expandedNeighbourIds" ? ["a"] : undefined)),
    });
    cy.getElementById.mockReturnValue(focusNode);

    expect(createRendererAdapter(cy).hasExpandedNeighbours("focus")).toBe(true);
  });

  it("hasExpandedNeighbours() is false for an unknown node or one with no recorded expansion", () => {
    const cy = fakeCy();
    const focusNode = fakeCollection({ length: 1, data: vi.fn(() => undefined) });
    cy.getElementById.mockImplementation((id: string) => (id === "focus" ? focusNode : fakeCollection({ length: 0 })));

    const adapter = createRendererAdapter(cy);

    expect(adapter.hasExpandedNeighbours("focus")).toBe(false);
    expect(adapter.hasExpandedNeighbours("missing")).toBe(false);
  });
});
