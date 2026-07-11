import { useEffect, useRef } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { FilterVisibilityResult } from "@/lib/explorer/compute-filter-visibility";
import type { NeighbourElement, RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";

import { Button } from "../ui/button";
import { Toast } from "../ui/toast";
import { CanvasLegend } from "./canvas-legend";
import { CanvasToolbar } from "./canvas-toolbar";
import { ConfirmDialog } from "./confirm-dialog";
import { DomainFocusNotice } from "./domain-focus-notice";
import { EmptyState } from "./empty-state";
import { FilterPanel } from "./filter-panel";
import { NodeContextMenu } from "./node-context-menu";
import { SearchOverlay } from "./search-overlay";
import { SidePanel } from "./side-panel";
import { useCanvasLegend } from "./use-canvas-legend";
import { useDomainFocus, type UseDomainFocusOptions } from "./use-domain-focus";
import { useFilterPanel, type UseFilterPanelOptions } from "./use-filter-panel";
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
  fetchLayerNodes?: UseFilterPanelOptions["fetchLayerNodes"];
  fetchPalette?: () => Promise<NodeKind[]>;
}

/** TASK-004: `graphId` defaults to config's single M1 canvas graph id --
 * pulled out (rather than inlined as `graphId ?? config.layoutGraphId`) to
 * keep ExplorerInteractions under Law E's complexity budget. */
function resolveGraphId(graphId: string | undefined, config: ExplorerConfig): string {
  return graphId ?? config.layoutGraphId;
}

/** Deep-link seam: `/explorer?focus=<iri>` (chat entity links) centers and
 * spotlights the named node once the canvas is live. Reads
 * window.location directly -- one-shot on mount, no router coupling. The
 * graph loads async after mount, so this polls until the node exists
 * (250ms x 40 = ~10s), then gives up silently -- a focus IRI that never
 * appears on the canvas is a no-op, not an error. */
const FOCUS_POLL_MS = 250;
const FOCUS_POLL_MAX_TRIES = 40;

function useFocusParam(adapter: RendererAdapter, config: ExplorerConfig, openNode: (id: string) => void) {
  const openNodeRef = useRef(openNode);
  useEffect(() => {
    openNodeRef.current = openNode;
  });
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (!focus) return undefined;
    let tries = 0;
    const focusIfLoaded = () => {
      tries += 1;
      if (adapter.getNodeData(focus) === undefined) {
        if (tries >= FOCUS_POLL_MAX_TRIES) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      adapter.centerOn(focus, config.centreAnimationMs);
      openNodeRef.current(focus);
    };
    const timer = setInterval(focusIfLoaded, FOCUS_POLL_MS);
    focusIfLoaded();
    return () => clearInterval(timer);
  }, [adapter, config.centreAnimationMs]);
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

// AC-2/AC-5: reuses the M1 CE-error EmptyState with a different message,
// its Retry button repurposed as the fix action (restore every type /
// clear the property filters) instead of a network retry.
function FilterEmptyState({
  visibility,
  onClearTypes,
  onClearPropertyFilters,
}: {
  visibility: FilterVisibilityResult | null;
  onClearTypes: () => void;
  onClearPropertyFilters: () => void;
}) {
  if (visibility?.isEmpty) {
    return <EmptyState message="All entity types are hidden -- turn one back on to see the graph." onRetry={onClearTypes} />;
  }
  if (visibility?.filterMatchEmpty) {
    return <EmptyState message="No loaded nodes match the current property filters." onRetry={onClearPropertyFilters} />;
  }
  return null;
}

// TASK-020: the shared corner-docked chrome (D-1..D-6) -- search trigger
// moved into the toolbar (D-3), legend + filters panel mounted alongside
// it. Extracted so ExplorerInteractions itself stays under Law E's line
// budget.
function CanvasFilterChrome({
  onOpenSearch,
  filterPanel,
  legend,
}: {
  onOpenSearch: () => void;
  filterPanel: ReturnType<typeof useFilterPanel>;
  legend: ReturnType<typeof useCanvasLegend>;
}) {
  return (
    <>
      <FilterEmptyState
        visibility={filterPanel.visibility}
        onClearTypes={filterPanel.clearEntityTypesOff}
        onClearPropertyFilters={() => filterPanel.setPropertyFilters([])}
      />
      <CanvasToolbar>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search nodes"
          data-testid="explorer-search-button"
          className="rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Search…
        </button>
      </CanvasToolbar>
      <CanvasLegend palette={legend.palette} loading={legend.loading} />
      <FilterPanel
        entityTypes={filterPanel.entityTypes}
        relTypes={filterPanel.relTypes}
        filterState={filterPanel.filterState}
        layerStatus={filterPanel.layerStatus}
        onToggleEntityType={filterPanel.toggleEntityType}
        onToggleRelType={filterPanel.toggleRelType}
        onSetPropertyFilters={filterPanel.setPropertyFilters}
        onToggleLayer={filterPanel.toggleLayer}
      />
    </>
  );
}

interface NodeInteractionOverlaysProps {
  resetLayout: () => void;
  panel: ReturnType<typeof useNodeSpotlight>["panel"];
  onClosePanel: () => void;
  onRetryPanel: () => void;
  search: ReturnType<typeof useSearchOverlay>;
  saveFailed: boolean;
  onDismissSaveFailure: () => void;
}

interface ExpansionOverlaysProps {
  menu: ReturnType<typeof useNodeContextMenu>["menu"];
  actions: ReturnType<typeof useContextMenuActions>;
  onCloseMenu: () => void;
  confirmState: ReturnType<typeof useNeighbourExpansion>["state"];
  neighbourExpansion: ReturnType<typeof useNeighbourExpansion>;
  domainFocus: ReturnType<typeof useDomainFocus>;
}

/** AC-1/AC-2: node context menu, expand confirm dialog, and the
 * domain-focus notice -- pure prop-forwarding, split out of
 * NodeInteractionOverlays to stay under Law E's line budget. */
function ExpansionOverlays({ menu, actions, onCloseMenu, confirmState, neighbourExpansion, domainFocus }: ExpansionOverlaysProps) {
  return (
    <>
      <NodeContextMenu
        position={menu?.position ?? null}
        canFocusDomain={menu?.canFocusDomain ?? false}
        isExpanded={menu?.isExpanded ?? false}
        onFocusDomain={actions.onFocusDomain}
        onExpand={actions.onExpand}
        onCollapse={actions.onCollapse}
        onClose={onCloseMenu}
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

/** AC-1..AC-10 chrome: reset-layout button, side panel, search overlay,
 * and save-failure toast -- pure prop-forwarding, pulled out so
 * ExplorerInteractions itself stays under Law E's line budget. */
function NodeInteractionOverlays({
  resetLayout,
  panel,
  onClosePanel,
  onRetryPanel,
  search,
  saveFailed,
  onDismissSaveFailure,
}: NodeInteractionOverlaysProps) {
  return (
    <>
      <Button
        variant="secondary"
        onClick={resetLayout}
        className="absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)]"
      >
        Reset layout
      </Button>
      <SidePanel state={panel} onClose={onClosePanel} onRetry={onRetryPanel} />
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
        <Toast message="Couldn't save layout position. Retrying stopped." onDismiss={onDismissSaveFailure} />
      )}
    </>
  );
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
  fetchLayerNodes,
  fetchPalette,
}: ExplorerInteractionsProps) {
  const { panel, openNode, close, retry } = useNodeSpotlight({ adapter, config, fetchNodeProps });
  useFocusParam(adapter, config, openNode);
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
  const filterPanel = useFilterPanel({ adapter, config, fetchLayerNodes });
  const legend = useCanvasLegend(fetchPalette);

  return (
    <>
      <CanvasFilterChrome onOpenSearch={search.openOverlay} filterPanel={filterPanel} legend={legend} />
      <NodeInteractionOverlays
        resetLayout={resetLayout}
        panel={panel}
        onClosePanel={close}
        onRetryPanel={retry}
        search={search}
        saveFailed={saveFailed}
        onDismissSaveFailure={dismissSaveFailure}
      />
      <ExpansionOverlays
        menu={menu}
        actions={actions}
        onCloseMenu={closeMenu}
        confirmState={confirmState}
        neighbourExpansion={neighbourExpansion}
        domainFocus={domainFocus}
      />
    </>
  );
}
