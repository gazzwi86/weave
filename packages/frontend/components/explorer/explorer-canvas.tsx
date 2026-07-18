import { Minimap } from "@/components/molecules/Minimap";
import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";

import { EmptyState } from "./empty-state";
import { ExplorerInteractions } from "./explorer-interactions";
import { useExplorerCanvas, type UseExplorerCanvasOptions } from "./use-explorer-canvas";

// ponytail: no design-token entry covers a widget's own footprint (only
// colour/spacing/radius/shadow/motion are tokenised) -- 160x100 is a fixed
// functional plate size, not a decorative literal (mirrors the superseded
// mini-map.tsx's own note). The svg's viewBox (148x88, refit-mock.html) is a
// separate coordinate space -- see use-explorer-canvas.ts's MINIMAP_SIZE.
const PLATE_WIDTH = 160;
const PLATE_HEIGHT = 100;

export interface ExplorerCanvasProps {
  options?: UseExplorerCanvasOptions;
  /** TASK-023 AC-7: session role claim, threaded down to ExplorerInteractions'
   * canEditCanvas gate -- see explorer-interactions.tsx's own doc comment. */
  role?: string | null;
}

/** AC-1/AC-2/AC-5: renders the CE-error empty-state on load failure (no
 * canvas div mounted, so Cytoscape never partially renders), otherwise the
 * force canvas container + bottom-right mini-map. TASK-003 adds the
 * spotlight side panel + search overlay once the renderer adapter exists. */
export function ExplorerCanvas({ options, role = null }: ExplorerCanvasProps) {
  const { loadState, errorMessage, minimapIndicator, minimapNodes, containerRef, retry, adapter, totalElements } =
    useExplorerCanvas(options);
  const config = options?.config ?? DEFAULT_EXPLORER_CONFIG;

  if (loadState === "error") {
    return <EmptyState message={errorMessage ?? "Unable to load the graph."} onRetry={retry} />;
  }

  return (
    // min-h-0 lets this flex child shrink to the parent's definite height
    // (app/explorer/page.tsx's h-screen flex column) instead of growing to
    // fit content -- without it a flex item defaults to its content's min
    // size, so the 0-height canvas below would blow the layout out instead
    // of filling it (classic flex "min-height: auto" trap).
    <div className="relative min-h-0 flex-1">
      {/* ponytail: explicit h-full/w-full, not absolute+inset-0 -- Cytoscape's
       * real constructor force-sets the container's inline `position` to
       * "relative" (cytoscape.js core/index.js), which would null out an
       * inset-based size (inset only offsets absolute/fixed/sticky boxes). */}
      <div ref={containerRef} data-testid="explorer-canvas" className="h-full w-full" />
      <div
        data-testid="explorer-minimap"
        className="pointer-events-none absolute right-[var(--space-4)] bottom-[var(--space-4)] overflow-hidden rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ width: PLATE_WIDTH, height: PLATE_HEIGHT }}
      >
        {minimapIndicator && <Minimap nodes={minimapNodes} viewportRect={minimapIndicator} />}
      </div>
      {adapter && (
        <ExplorerInteractions
          adapter={adapter}
          config={config}
          graphId={config.layoutGraphId}
          role={role}
          totalElements={totalElements}
        />
      )}
    </div>
  );
}
