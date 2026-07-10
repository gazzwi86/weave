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
