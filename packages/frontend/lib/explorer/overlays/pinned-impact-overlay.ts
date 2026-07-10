import type { Overlay, OverlayEngine, OverlayLegendModel } from "../overlay-engine";
import type { RendererAdapter } from "../renderer-adapter";

/** ADR-018 traversal result -- the pin's input, produced by the impact/
 * dependency walk (whichever direction was run to get here). */
export interface PinnedTraceResult {
  sourceIri: string;
  memberIris: string[];
}

function buildLegend(traceResult: PinnedTraceResult, adapter: RendererAdapter | null): OverlayLegendModel {
  const total = traceResult.memberIris.length;
  const hidden = adapter ? traceResult.memberIris.filter((iri) => adapter.isHidden(iri)).length : 0;
  return {
    title: "Impact trace",
    entries: [{ label: `${total} node${total === 1 ? "" : "s"} in trace`, colour: "var(--color-warn)" }],
    note: hidden > 0 ? `${hidden} of ${total} hidden by filters` : undefined,
  };
}

/** TASK-028 AC-3/AC-4/AC-5/AC-7: pin a traversal result on canvas until
 * unpinned. Highlight channel (EXPLORER_TRACE_CLASS via
 * setTraceHighlight/clearTraceHighlight) -- deliberately no
 * exclusiveGroup, so the pin coexists with an active "colour" overlay
 * (AC-7) instead of competing for the same channel (TASK-021 engine). */
export function createPinnedImpactOverlay(
  traceResult: PinnedTraceResult,
  engine: OverlayEngine,
  notify: (message: string) => void,
): Overlay {
  const id = `pinned-impact:${traceResult.sourceIri}`;
  let lastAdapter: RendererAdapter | null = null;
  let unsubscribe: (() => void) | null = null;

  return {
    id,
    apply(adapter) {
      lastAdapter = adapter;
      const loadedIds = new Set(adapter.listNodes().map((node) => node.id));
      adapter.setTraceHighlight(traceResult.memberIris.filter((iri) => loadedIds.has(iri)));
      // AC-4: any removal path (explicit delete, layer toggle, a future
      // TASK-024 delete flow) that removes the trace's source node
      // auto-clears the pin -- never left pointing at a gone node.
      unsubscribe = adapter.onElementRemoved((removedId) => {
        if (removedId !== traceResult.sourceIri) return;
        engine.deactivate(id, adapter);
        notify("Pinned trace source deleted");
      });
    },
    remove(adapter) {
      adapter.clearTraceHighlight();
      unsubscribe?.();
      unsubscribe = null;
    },
    legend(): OverlayLegendModel {
      // AC-5: live read at call-time (not snapshotted at apply()), so a
      // filter change after the pin still updates the hidden count.
      return buildLegend(traceResult, lastAdapter);
    },
  };
}
