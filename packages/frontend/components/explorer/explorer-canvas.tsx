import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";

import { EmptyState } from "./empty-state";
import { ExplorerInteractions } from "./explorer-interactions";
import { MiniMap } from "./mini-map";
import { useExplorerCanvas, type UseExplorerCanvasOptions } from "./use-explorer-canvas";

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
  const { loadState, errorMessage, minimapIndicator, containerRef, retry, adapter } = useExplorerCanvas(options);
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
      <MiniMap indicator={minimapIndicator} />
      {adapter && <ExplorerInteractions adapter={adapter} config={config} graphId={config.layoutGraphId} role={role} />}
    </div>
  );
}
