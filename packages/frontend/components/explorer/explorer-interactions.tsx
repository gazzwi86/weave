import type { ExplorerConfig } from "@/lib/explorer/config";
import type { NeighbourElement, RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { Button } from "../ui/button";
import { Toast } from "../ui/toast";
import { ConfirmDialog } from "./confirm-dialog";
import { DomainFocusNotice } from "./domain-focus-notice";
import { NodeContextMenu } from "./node-context-menu";
import { SearchOverlay } from "./search-overlay";
import { SidePanel } from "./side-panel";
import { useDomainFocus, type UseDomainFocusOptions } from "./use-domain-focus";
import { useLayoutPersistence } from "./use-layout-persistence";
import { useNeighbourExpansion } from "./use-neighbour-expansion";
import { useNodeContextMenu } from "./use-node-context-menu";
import { useNodeSpotlight, type UseNodeSpotlightOptions } from "./use-node-spotlight";
import { useSearchOverlay } from "./use-search-overlay";

export interface ExplorerInteractionsProps {
  adapter: RendererAdapter;
  config: ExplorerConfig;
  /** TASK-004 AC-1/AC-2/AC-4: the graph saved positions persist against --
   * defaults to config's single M1 canvas graph id (see config.ts) since
   * callers that don't care about layout persistence (most TASK-005 tests)
   * shouldn't have to pass it. */
  graphId?: string;
  /** Test seams -- default to the real CE-READ-1 proxy fetches. */
  fetchNodeProps?: UseNodeSpotlightOptions["fetchNodeProps"];
  fetchDomainMembers?: UseDomainFocusOptions["fetchDomainMembers"];
}

/** TASK-004: `graphId` defaults to config's single M1 canvas graph id --
 * pulled out (rather than inlined as `graphId ?? config.layoutGraphId`) to
 * keep ExplorerInteractions under Law E's complexity budget. */
function resolveGraphId(graphId: string | undefined, config: ExplorerConfig): string {
  return graphId ?? config.layoutGraphId;
}

/** TASK-005 AC-3/AC-4/AC-5: the context menu's actions, and the confirm
 * dialog gating an over-threshold expand -- extracted so
 * ExplorerInteractions itself stays under Law E's 50-line budget. */
function useContextMenuActions(
  adapter: RendererAdapter,
  menu: ReturnType<typeof useNodeContextMenu>["menu"],
  panelNeighbours: NeighbourElement[],
  domainFocus: ReturnType<typeof useDomainFocus>,
  neighbourExpansion: ReturnType<typeof useNeighbourExpansion>
) {
  return {
    onFocusDomain: () => menu && domainFocus.focusDomain(menu.nodeId),
    onExpand: () => menu && neighbourExpansion.requestExpand(menu.nodeId, panelNeighbours),
    onCollapse: () => menu && neighbourExpansion.collapse(menu.nodeId),
  };
}

/** AC-1..AC-10: composes node-spotlight, search, domain-focus, and
 * neighbour expand/collapse onto the ADR-001 renderer-adapter seam. A
 * search-result click hands off to the same node-spotlight flow as a
 * direct canvas click; a right-click on the spotlighted node opens the
 * context menu driving domain-focus and expand/collapse.
 * TASK-004: also wires drag-persist-with-retry-toast + reset-layout. */
export function ExplorerInteractions({
  adapter,
  config,
  graphId,
  fetchNodeProps,
  fetchDomainMembers,
}: ExplorerInteractionsProps) {
  const { panel, openNode, close, retry } = useNodeSpotlight({ adapter, config, fetchNodeProps });
  const search = useSearchOverlay({ adapter, config, onResultSelected: openNode });
  const { saveFailed, dismissSaveFailure, resetLayout } = useLayoutPersistence({
    adapter,
    config,
    graphId: resolveGraphId(graphId, config),
  });
  const domainFocus = useDomainFocus({ adapter, config, fetchDomainMembers });
  const neighbourExpansion = useNeighbourExpansion({ adapter, config });
  const { menu, closeMenu } = useNodeContextMenu({ adapter, config, panel });
  const panelNeighbours = panel.status === "loaded" ? panel.neighbours : [];
  const actions = useContextMenuActions(adapter, menu, panelNeighbours, domainFocus, neighbourExpansion);
  const confirmState = neighbourExpansion.state;

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
      <Button
        variant="secondary"
        onClick={resetLayout}
        className="absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)]"
      >
        Reset layout
      </Button>
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
      {saveFailed && (
        <Toast message="Couldn't save layout position. Retrying stopped." onDismiss={dismissSaveFailure} />
      )}
      <NodeContextMenu
        position={menu?.position ?? null}
        canFocusDomain={menu?.canFocusDomain ?? false}
        isExpanded={menu?.isExpanded ?? false}
        onFocusDomain={actions.onFocusDomain}
        onExpand={actions.onExpand}
        onCollapse={actions.onCollapse}
        onClose={closeMenu}
      />
      <ConfirmDialog
        open={confirmState.status === "confirm"}
        newCount={confirmState.status === "confirm" ? confirmState.newCount : 0}
        onConfirm={neighbourExpansion.confirmExpand}
        onCancel={neighbourExpansion.cancelExpand}
      />
      <DomainFocusNotice state={domainFocus.state} onRetry={domainFocus.retry} onDismiss={domainFocus.dismissError} />
    </>
  );
}
