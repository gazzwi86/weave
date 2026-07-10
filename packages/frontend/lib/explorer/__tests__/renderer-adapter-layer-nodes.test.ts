import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-020 AC-6: governed-layer nodes are added/removed through the same
// adapter seam as everything else (ADR-014) -- use-filter-panel never calls
// cy.add/cy.remove directly.
describe("createRendererAdapter -- TASK-020 addLayerNodes/removeElements", () => {
  it("adds elements not already on the canvas and returns their ids", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));
    const elements = [{ data: { id: "https://weave.io/entity/term-1", label: "Revenue" } }];

    const added = createRendererAdapter(cy).addLayerNodes(elements);

    expect(cy.add).toHaveBeenCalledWith(elements);
    expect(added).toEqual(["https://weave.io/entity/term-1"]);
  });

  it("skips an element already present on the canvas (shared with the base graph)", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 1 }));
    const elements = [{ data: { id: "https://weave.io/entity/existing-1", label: "Existing" } }];

    const added = createRendererAdapter(cy).addLayerNodes(elements);

    expect(cy.add).not.toHaveBeenCalled();
    expect(added).toEqual([]);
  });

  it("removes only the given element ids (layer toggle-off)", () => {
    const cy = fakeCy();
    const removable = fakeCollection();
    const filterFn = vi.fn(() => removable);
    cy.elements.mockReturnValue(fakeCollection({ filter: filterFn }));

    createRendererAdapter(cy).removeElements(["https://weave.io/entity/term-1"]);

    expect(filterFn).toHaveBeenCalled();
    expect(cy.remove).toHaveBeenCalledWith(removable);
  });
});

// TASK-020: use-filter-panel needs the full currently-on-canvas element set
// (nodes + edges, in CytoscapeElement shape) to feed computeFilterVisibility --
// adapter is the single source of truth (reflects layer add/remove, expand/
// collapse etc), never a stale copy of what load() was first called with.
describe("createRendererAdapter -- TASK-020 listElements", () => {
  it("returns every node and edge currently on the canvas as CytoscapeElement", () => {
    const cy = fakeCy();
    const nodeData: Record<string, string> = { label: "Revenue", bpmo_kind: "Concept" };
    cy.nodes.mockReturnValue(
      fakeCollection({
        map: vi.fn((fn) => [fn({ id: () => "n1", data: (key: string) => nodeData[key] })]),
      })
    );
    const edgeData: Record<string, string> = { label: "governedBy", source: "n1", target: "n2" };
    cy.edges.mockReturnValue(
      fakeCollection({
        map: vi.fn((fn) => [fn({ id: () => "e1", data: (key: string) => edgeData[key] })]),
      })
    );

    expect(createRendererAdapter(cy).listElements()).toEqual([
      { data: { id: "n1", label: "Revenue", bpmo_kind: "Concept", key_properties: undefined } },
      { data: { id: "e1", label: "governedBy", source: "n1", target: "n2" } },
    ]);
  });
});
