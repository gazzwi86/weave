import { EmptyState } from "./empty-state";
import { MiniMap } from "./mini-map";
import { useExplorerCanvas, type UseExplorerCanvasOptions } from "./use-explorer-canvas";

export interface ExplorerCanvasProps {
  options?: UseExplorerCanvasOptions;
}

/** AC-1/AC-2/AC-5: renders the CE-error empty-state on load failure (no
 * canvas div mounted, so Cytoscape never partially renders), otherwise the
 * force canvas container + bottom-right mini-map. */
export function ExplorerCanvas({ options }: ExplorerCanvasProps) {
  const { loadState, errorMessage, minimapIndicator, containerRef, retry } = useExplorerCanvas(options);

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
    </div>
  );
}
