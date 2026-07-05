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
    <div className="relative min-h-screen">
      <div ref={containerRef} data-testid="explorer-canvas" className="absolute inset-0" />
      <MiniMap indicator={minimapIndicator} />
    </div>
  );
}
