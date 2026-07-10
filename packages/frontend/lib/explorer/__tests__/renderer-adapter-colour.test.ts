import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-021 AC-4/AC-7: the colour seam every overlay's apply()/remove() goes
// through -- one batched transaction, nodes grouped by target colour
// (bounded by distinct colours, never a per-node loop).
describe("createRendererAdapter -- TASK-021 colour seam", () => {
  it("applies each node's mapped colour and the fallback colour to unmapped nodes, in one batch (AC-7)", () => {
    const cy = fakeCy();
    const redNodes = fakeCollection();
    const blueNodes = fakeCollection();
    const fallbackNodes = fakeCollection();
    cy.nodes.mockReturnValue(
      fakeCollection({
        filter: vi
          .fn()
          .mockReturnValueOnce(redNodes)
          .mockReturnValueOnce(blueNodes)
          .mockReturnValueOnce(fallbackNodes),
      })
    );

    createRendererAdapter(cy).applyNodeColours({ n1: "red", n2: "blue" }, "grey");

    expect(cy.batch).toHaveBeenCalledTimes(1);
    expect(redNodes.style).toHaveBeenCalledWith({ "background-color": "red" });
    expect(blueNodes.style).toHaveBeenCalledWith({ "background-color": "blue" });
    expect(fallbackNodes.style).toHaveBeenCalledWith({ "background-color": "grey" });
  });

  it("applies only the fallback colour when no nodes are mapped", () => {
    const cy = fakeCy();
    const allNodes = fakeCollection();
    cy.nodes.mockReturnValue(fakeCollection({ filter: vi.fn(() => allNodes) }));

    createRendererAdapter(cy).applyNodeColours({}, "grey");

    expect(allNodes.style).toHaveBeenCalledWith({ "background-color": "grey" });
  });

  // AC-4: clearing restores the base stylesheet's bpmo_kind-selector
  // colouring, since colour overlays only ever apply an inline override.
  it("clears every node's inline colour override in one batch (AC-4)", () => {
    const cy = fakeCy();
    const allNodes = fakeCollection();
    cy.nodes.mockReturnValue(allNodes);

    createRendererAdapter(cy).clearNodeColours();

    expect(cy.batch).toHaveBeenCalledTimes(1);
    expect(allNodes.style).toHaveBeenCalledWith({ "background-color": "" });
  });
});
