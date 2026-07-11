import type { GroupedDiff } from "../diff/group-triples";
import type { Overlay, OverlayLegendModel } from "../overlay-engine";
import type { RendererAdapter } from "../renderer-adapter";
import type { DiffClassName, DiffOverlayAssignment } from "../renderer-adapter-diff";
import type { CytoscapeElement } from "../types";

export interface DiffGlyphs {
  added: string;
  removed: string;
  modified: string;
}

function ghostElements(grouped: GroupedDiff): CytoscapeElement[] {
  return [...grouped.removedGhostNodes, ...grouped.removedEdgeGhosts, ...grouped.removedNodeGhosts];
}

function assignmentsFor(grouped: GroupedDiff, glyphs: DiffGlyphs): DiffOverlayAssignment[] {
  const assignment = (id: string, className: DiffClassName, glyph: string): DiffOverlayAssignment => ({
    id,
    className,
    glyph,
  });
  return [
    ...grouped.addedNodeIds.map((id) => assignment(id, "explorer-diff-added", glyphs.added)),
    ...grouped.addedEdgeRefs.map((ref) => assignment(ref.id, "explorer-diff-added", glyphs.added)),
    ...grouped.modifiedNodeIds.map((id) => assignment(id, "explorer-diff-modified", glyphs.modified)),
    ...grouped.modifiedEdgeRefs.map((ref) => assignment(ref.id, "explorer-diff-modified", glyphs.modified)),
    ...grouped.removedNodeGhosts.map((el) => assignment(el.data.id, "explorer-diff-removed", glyphs.removed)),
    ...grouped.removedEdgeGhosts.map((el) => assignment(el.data.id, "explorer-diff-removed", glyphs.removed)),
  ];
}

function summaryNote(grouped: GroupedDiff): string {
  const { added, removed, modified } = grouped.counts;
  return `Added: ${added} · Removed: ${removed} · Modified: ${modified}`;
}

/** TASK-022 AC-3/AC-7/AC-8: renders a CE-DIFF-1 diff (already grouped by
 * `groupTriples`) as border-colour + glyph overlays -- added/modified
 * elements are already on the loaded (`to`-version) canvas; removed
 * elements aren't, so they're added as ghosts (implementation hint: the
 * hint's "remove ghosts on deactivation" is this overlay's own remove()),
 * reusing the TASK-020 addLayerNodes/removeElements ghost-add/cleanup seam
 * rather than a bespoke one. */
export function createDiffOverlay(grouped: GroupedDiff, glyphs: DiffGlyphs): Overlay {
  let addedGhostIds: string[] = [];

  return {
    id: "diff",
    exclusiveGroup: "colour",
    apply(adapter: RendererAdapter) {
      addedGhostIds = adapter.addLayerNodes(ghostElements(grouped));
      adapter.setDiffOverlay(assignmentsFor(grouped, glyphs));
    },
    remove(adapter: RendererAdapter) {
      adapter.removeElements(addedGhostIds);
      adapter.clearDiffOverlay();
      addedGhostIds = [];
    },
    legend(): OverlayLegendModel {
      return {
        title: "Diff",
        entries: [
          { label: `Added (${glyphs.added})`, colour: "var(--color-success)" },
          { label: `Removed (${glyphs.removed})`, colour: "var(--color-danger)" },
          { label: `Modified (${glyphs.modified})`, colour: "var(--color-warn)" },
        ],
        note: summaryNote(grouped),
      };
    },
  };
}
