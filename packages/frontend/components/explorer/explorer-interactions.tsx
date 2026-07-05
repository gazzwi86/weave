import type { ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { SearchOverlay } from "./search-overlay";
import { SidePanel } from "./side-panel";
import { useNodeSpotlight } from "./use-node-spotlight";
import { useSearchOverlay } from "./use-search-overlay";

export interface ExplorerInteractionsProps {
  adapter: RendererAdapter;
  config: ExplorerConfig;
  /** TASK-004 AC-1/AC-2/AC-4: the graph saved positions persist against. */
  graphId: string;
}

/** AC-1..AC-8: composes the node-spotlight side panel and the search
 * overlay onto the ADR-001 renderer-adapter seam. A search-result click
 * hands off to the same node-spotlight flow as a direct canvas click.
 * TASK-004: also wires drag-persist-with-retry-toast + reset-layout. */
export function ExplorerInteractions({ adapter, config }: ExplorerInteractionsProps) {
  const { panel, openNode, close, retry } = useNodeSpotlight({ adapter, config });
  const search = useSearchOverlay({ adapter, config, onResultSelected: openNode });

  return (
    <>
      <button
        type="button"
        onClick={search.openOverlay}
        aria-label="Search nodes"
        data-testid="explorer-search-button"
        className="absolute left-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
      >
        Search…
      </button>
      <SidePanel state={panel} onClose={close} onRetry={retry} />
      <SearchOverlay
        open={search.open}
        query={search.query}
        results={search.results}
        noResults={search.noResults}
        onQueryChange={search.setQuery}
        onSelect={search.selectResult}
        onClose={search.closeOverlay}
      />
    </>
  );
}
