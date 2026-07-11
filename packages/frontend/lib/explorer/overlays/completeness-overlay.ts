import { humaniseRelName } from "../humanise-rel-name";
import type { OntologyRelationshipEntry } from "../validate-closure";
import type { Overlay, OverlayLegendModel } from "../overlay-engine";
import type { RendererAdapter } from "../renderer-adapter";
import type { CoverageGapRow } from "../fetch-coverage-gaps";

export interface GapEntry {
  missingLink: string;
  label: string;
}

/** TASK-027: one overlay per fetched `coverage_gap` result -- rows are
 * already resolved by the caller (use-completeness-overlay.ts), matching
 * the house pattern set by diff-overlay.ts/pinned-impact-overlay.ts (async
 * fetch happens outside `apply()`, which stays synchronous per the
 * `Overlay` interface). Deliberately no `exclusiveGroup`: it's a badge
 * channel, so it coexists with an active "colour" overlay (AC-7) --
 * mutual exclusion with the diff overlay is the caller's job (a separate,
 * explicit check, since diff also has no shared group with this). */
export function createCompletenessOverlay(
  rows: CoverageGapRow[],
  relationships: OntologyRelationshipEntry[]
): Overlay & { gapIndex(): Record<string, GapEntry[]> } {
  const byIri = new Map<string, GapEntry[]>();
  for (const row of rows) {
    const entries = byIri.get(row.entityIri) ?? [];
    entries.push({ missingLink: row.missingLink, label: humaniseRelName(row.missingLink, relationships) });
    byIri.set(row.entityIri, entries);
  }

  let onCanvasCount = 0;
  let offCanvasCount = 0;

  return {
    id: "completeness",
    apply(adapter: RendererAdapter) {
      const counts: Record<string, number> = {};
      onCanvasCount = 0;
      offCanvasCount = 0;
      for (const [iri, entries] of byIri) {
        if (adapter.getNodeData(iri) === undefined) {
          offCanvasCount += 1;
          continue;
        }
        counts[iri] = entries.length;
        onCanvasCount += 1;
      }
      adapter.setBadges(counts); // AC-1
    },
    remove(adapter: RendererAdapter) {
      adapter.clearBadges();
    },
    legend(): OverlayLegendModel {
      const note =
        `${onCanvasCount} ${onCanvasCount === 1 ? "entity" : "entities"} with gaps` +
        (offCanvasCount > 0 ? `; ${offCanvasCount} not shown` : ""); // AC-6
      return { title: "Completeness", entries: [], note };
    },
    gapIndex() {
      return Object.fromEntries(byIri);
    },
  };
}
