import { describe, expect, it, vi } from "vitest";

import { createRendererAdapter } from "../renderer-adapter";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-022 AC-3: the diff overlay's border-colour + glyph seam -- distinct
// from the "colour" background-colour seam (renderer-adapter-colour.ts) so
// diff can coexist with the trace overlay, and satisfies data-viz.md's
// "colour is never the sole carrier" rule via a glyph-prefixed label.
describe("createRendererAdapter -- TASK-022 diff overlay seam", () => {
  it("applies a diff class and a glyph-prefixed label to each assigned element", () => {
    const cy = fakeCy();
    const target = fakeCollection({ data: vi.fn(() => "Capability A") });
    cy.getElementById.mockReturnValue(target);

    createRendererAdapter(cy).setDiffOverlay([{ id: "n1", className: "explorer-diff-added", glyph: "+" }]);

    expect(cy.getElementById).toHaveBeenCalledWith("n1");
    expect(target.addClass).toHaveBeenCalledWith("explorer-diff-added");
    expect(target.data).toHaveBeenCalledWith("diffLabel", "+ Capability A");
  });

  it("is a no-op for an assignment whose id is not on the canvas", () => {
    const cy = fakeCy();
    cy.getElementById.mockReturnValue(fakeCollection({ length: 0 }));

    expect(() =>
      createRendererAdapter(cy).setDiffOverlay([{ id: "missing", className: "explorer-diff-modified", glyph: "~" }])
    ).not.toThrow();
  });

  it("clears every diff class and the glyph label from every element", () => {
    const cy = fakeCy();
    const all = fakeCollection();
    cy.elements.mockReturnValue(all);

    createRendererAdapter(cy).clearDiffOverlay();

    expect(all.removeClass).toHaveBeenCalledWith("explorer-diff-added");
    expect(all.removeClass).toHaveBeenCalledWith("explorer-diff-removed");
    expect(all.removeClass).toHaveBeenCalledWith("explorer-diff-modified");
    expect(all.data).toHaveBeenCalledWith("diffLabel", undefined);
  });
});
