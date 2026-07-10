import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-028 AC-3/AC-4/AC-5: the trace-highlight seam the pinned impact
// overlay goes through -- a distinct amber border class (EXPLORER_TRACE_CLASS),
// never the "colour" background-colour seam (renderer-adapter-colour.ts),
// so a pin can coexist with an active colour overlay (AC-7).
describe("createRendererAdapter -- TASK-028 trace-highlight seam", () => {
  it("sets the trace class on exactly the given node ids, clearing any prior trace first (AC-3)", () => {
    const cy = fakeCy();
    const allNodes = fakeCollection();
    const target = fakeCollection();
    cy.nodes.mockReturnValue(allNodes);
    cy.getElementById.mockReturnValue(target);

    createRendererAdapter(cy).setTraceHighlight(["n1", "n2"]);

    expect(allNodes.removeClass).toHaveBeenCalledWith("explorer-trace");
    expect(cy.getElementById).toHaveBeenCalledWith("n1");
    expect(cy.getElementById).toHaveBeenCalledWith("n2");
    expect(target.addClass).toHaveBeenCalledWith("explorer-trace");
  });

  it("clears the trace class from every node", () => {
    const cy = fakeCy();
    const allNodes = fakeCollection();
    cy.nodes.mockReturnValue(allNodes);

    createRendererAdapter(cy).clearTraceHighlight();

    expect(allNodes.removeClass).toHaveBeenCalledWith("explorer-trace");
  });

  it("reads a node's live hidden state off the real cytoscape element (AC-5)", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ hidden: vi.fn(() => true) }));

    expect(createRendererAdapter(cy).isHidden("n1")).toBe(true);
  });

  it("fires the removed-element handler with the removed element's id, and unsubscribes on request (AC-4)", () => {
    const cy = fakeCy();
    const adapter = createRendererAdapter(cy);
    const handler = vi.fn();

    const unsubscribe = adapter.onElementRemoved(handler);
    cy.fireRemove({ id: () => "n1" });
    expect(handler).toHaveBeenCalledWith("n1");

    unsubscribe();
    cy.fireRemove({ id: () => "n2" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
