"use client";

import { useEffect } from "react";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import { useExplorerCanvas } from "@/components/explorer/use-explorer-canvas";

export interface GroundedGraphViewProps {
  /** AC-7: IRIs the answer is grounded in -- empty means "no grounded
   * matches", not an error/blank canvas. */
  groundedIris: string[];
}

/** CE-V1-TASK-032 AC-7: embeds the Explorer canvas and reuses its
 * search-spotlight highlight primitive (`highlightNodes`/`resetOpacity`) to
 * glow the answer's grounded nodes and dim everything else -- never a
 * second highlight mechanism (brief's implementation hint). */
export function GroundedGraphView({ groundedIris }: GroundedGraphViewProps) {
  const { containerRef, adapter, loadState } = useExplorerCanvas();
  const config = DEFAULT_EXPLORER_CONFIG;

  useEffect(() => {
    if (!adapter) return undefined;
    adapter.highlightNodes(groundedIris, config.spotlightDimOpacity);
    return () => adapter.resetOpacity();
  }, [adapter, groundedIris, config.spotlightDimOpacity]);

  return (
    // ponytail: mini-canvas height derived from --space-10 (5x = 320px)
    // rather than a literal px -- Law 20 token discipline, no dedicated
    // "mini-canvas-height" token exists yet in tokens.md.
    <div className="relative h-[calc(var(--space-10)*5)] min-h-0">
      <div ref={containerRef} data-testid="grounded-graph-canvas" className="h-full w-full" />
      {loadState === "ready" && groundedIris.length === 0 && (
        <p
          data-testid="grounded-graph-empty-note"
          className="absolute bottom-[var(--space-2)] left-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
        >
          No grounded matches for this answer
        </p>
      )}
    </div>
  );
}
