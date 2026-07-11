import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";
import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-023 AC-8: reconcileElement swaps a locally-ref'd optimistic
// element's identity for the real IRI CE-WRITE-1 returned. Cytoscape
// element ids are immutable after creation, so this is remove-then-add
// under the hood, same seam addLayerNodes/removeElements already use.
describe("createRendererAdapter -- TASK-023 reconcileElement", () => {
  it("removes the local-ref element and adds the real element at the same position", () => {
    const cy = fakeCy();
    const localRefEl = fakeCollection({ length: 1, position: vi.fn(() => ({ x: 42, y: 7 })) });
    cy.getElementById.mockImplementation((id: string) => (id === "local:1" ? localRefEl : fakeCollection({ length: 0 })));

    createRendererAdapter(cy).reconcileElement("local:1", { data: { id: "urn:node:real-1", label: "New process" } });

    expect(cy.remove).toHaveBeenCalledWith(localRefEl);
    expect(cy.add).toHaveBeenCalledWith([
      { data: { id: "urn:node:real-1", label: "New process" }, position: { x: 42, y: 7 } },
    ]);
  });

  it("is a no-op when the local ref is no longer on canvas (already rolled back)", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    createRendererAdapter(cy).reconcileElement("local:1", { data: { id: "urn:node:real-1", label: "New process" } });

    expect(cy.remove).not.toHaveBeenCalled();
    expect(cy.add).not.toHaveBeenCalled();
  });

  it("does not duplicate when the real IRI already exists on canvas (CE-WRITE-1 dedup case)", () => {
    const cy = fakeCy();
    const localRefEl = fakeCollection({ length: 1, position: vi.fn(() => ({ x: 5, y: 5 })) });
    const existingRealEl = fakeCollection({ length: 1 });
    cy.getElementById.mockImplementation((id: string) => {
      if (id === "local:1") return localRefEl;
      if (id === "urn:node:existing") return existingRealEl;
      return fakeCollection({ length: 0 });
    });

    createRendererAdapter(cy).reconcileElement("local:1", { data: { id: "urn:node:existing", label: "Dup" } });

    expect(cy.remove).toHaveBeenCalledWith(localRefEl);
    expect(cy.add).not.toHaveBeenCalled();
  });
});
