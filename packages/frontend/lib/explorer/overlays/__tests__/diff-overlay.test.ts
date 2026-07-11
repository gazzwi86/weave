import { describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "../../renderer-adapter";
import type { GroupedDiff } from "../../diff/group-triples";
import { createDiffOverlay } from "../diff-overlay";

function fakeAdapter(): RendererAdapter {
  return {
    // Mirrors the real addLayerNodesOn's dedupe-by-id (TASK-020).
    addLayerNodes: vi.fn((elements: { data: { id: string } }[]) => [...new Set(elements.map((e) => e.data.id))]),
    removeElements: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
  } as unknown as RendererAdapter;
}

const EMPTY_GROUPED: GroupedDiff = {
  addedNodeIds: [],
  addedEdgeRefs: [],
  modifiedNodeIds: [],
  modifiedEdgeRefs: [],
  removedNodeGhosts: [],
  removedEdgeGhosts: [],
  removedGhostNodes: [],
  counts: { added: 0, removed: 0, modified: 0 },
};

describe("createDiffOverlay", () => {
  // AC-3/AC-7: registers on the "colour" exclusiveGroup (mutual exclusion
  // with heatmap/domain-colouring, engine-level).
  it("should register the diff overlay in the exclusive colour group", () => {
    const overlay = createDiffOverlay(EMPTY_GROUPED, { added: "+", removed: "−", modified: "~" });
    expect(overlay.id).toBe("diff");
    expect(overlay.exclusiveGroup).toBe("colour");
  });

  // AC-3: added/modified nodes+edges get border class + glyph via the
  // adapter's diff seam; removed elements are added as ghosts first (so
  // getElementById can find them), then coloured the same way.
  it("colours added, modified, and ghosted-removed elements with the right class + glyph", () => {
    const grouped: GroupedDiff = {
      addedNodeIds: ["n1"],
      addedEdgeRefs: [{ id: "n2|p|n3", source: "n2", target: "n3", predicate: "p" }],
      modifiedNodeIds: ["n4"],
      modifiedEdgeRefs: [{ id: "n5|p|n6", source: "n5", target: "n6", predicate: "p" }],
      removedNodeGhosts: [{ data: { id: "n7", label: "n7" } }],
      removedEdgeGhosts: [{ data: { id: "n8|p|n9", source: "n8", target: "n9" } }],
      removedGhostNodes: [{ data: { id: "n8", label: "n8" } }, { data: { id: "n9", label: "n9" } }],
      counts: { added: 2, removed: 2, modified: 2 },
    };
    const adapter = fakeAdapter();
    const overlay = createDiffOverlay(grouped, { added: "+", removed: "−", modified: "~" });

    overlay.apply(adapter);

    expect(adapter.addLayerNodes).toHaveBeenCalledWith([
      { data: { id: "n8", label: "n8" } },
      { data: { id: "n9", label: "n9" } },
      { data: { id: "n8|p|n9", source: "n8", target: "n9" } },
      { data: { id: "n7", label: "n7" } },
    ]);
    expect(adapter.setDiffOverlay).toHaveBeenCalledWith([
      { id: "n1", className: "explorer-diff-added", glyph: "+" },
      { id: "n2|p|n3", className: "explorer-diff-added", glyph: "+" },
      { id: "n4", className: "explorer-diff-modified", glyph: "~" },
      { id: "n5|p|n6", className: "explorer-diff-modified", glyph: "~" },
      { id: "n7", className: "explorer-diff-removed", glyph: "−" },
      { id: "n8|p|n9", className: "explorer-diff-removed", glyph: "−" },
    ]);
  });

  // AC-8: remove() cleans up exactly the ghost ids apply() added, plus
  // clears the diff classes/labels.
  it("removes the ghost elements it added and clears the diff overlay on remove()", () => {
    const grouped: GroupedDiff = {
      ...EMPTY_GROUPED,
      removedNodeGhosts: [{ data: { id: "n7", label: "n7" } }],
      removedGhostNodes: [{ data: { id: "n7", label: "n7" } }],
    };
    const adapter = fakeAdapter();
    const overlay = createDiffOverlay(grouped, { added: "+", removed: "-", modified: "~" });

    overlay.apply(adapter);
    overlay.remove(adapter);

    expect(adapter.removeElements).toHaveBeenCalledWith(["n7"]);
    expect(adapter.clearDiffOverlay).toHaveBeenCalledOnce();
  });

  // Summary panel (data-viz.md): the legend note carries added/removed/
  // modified counts -- the non-colour carrier alongside the per-element glyph.
  it("legend lists added/removed/modified counts", () => {
    const grouped: GroupedDiff = { ...EMPTY_GROUPED, counts: { added: 3, removed: 1, modified: 2 } };
    const overlay = createDiffOverlay(grouped, { added: "+", removed: "−", modified: "~" });

    const legend = overlay.legend();

    expect(legend.title).toBe("Diff");
    expect(legend.note).toBe("Added: 3 · Removed: 1 · Modified: 2");
    expect(legend.entries).toEqual([
      { label: "Added (+)", colour: "var(--color-success)" },
      { label: "Removed (−)", colour: "var(--color-danger)" },
      { label: "Modified (~)", colour: "var(--color-warn)" },
    ]);
  });
});
