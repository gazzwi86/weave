import { useEffect, useRef, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { fetchOntologyTypes } from "@/lib/explorer/fetch-ontology-types";
import type { NeighbourElement, RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind, RelKind } from "@/lib/explorer/types";
import type { OntologyRelationshipEntry } from "@/lib/explorer/validate-closure";
import { canEditCanvas } from "@/lib/explorer/can-edit-canvas";

import { Button } from "../ui/button";
import { Toast } from "../ui/toast";
import { CanvasAskBar } from "./canvas-ask-bar";
import { CanvasFilterChrome } from "./canvas-filter-chrome";
import { CompletenessNotice } from "./completeness-notice";
import { ConfirmDialog } from "./confirm-dialog";
import { DomainFocusNotice } from "./domain-focus-notice";
import { DrawEdgeOverlay } from "./draw-edge-overlay";
import { NodeContextMenu } from "./node-context-menu";
import { QuickAddOverlay } from "./quick-add-overlay";
import { SearchOverlay } from "./search-overlay";
import { SidePanel } from "./side-panel";
import { useCanvasLegend } from "./use-canvas-legend";
import { useCanvasOverlayToggles } from "./use-canvas-overlay-toggles";
import { useCompletenessOverlay } from "./use-completeness-overlay";
import { useDomainFocus, type UseDomainFocusOptions } from "./use-domain-focus";
import { useFilterPanel, type UseFilterPanelOptions } from "./use-filter-panel";
import { useLayoutPersistence } from "./use-layout-persistence";
import { useNeighbourExpansion } from "./use-neighbour-expansion";
import { useNodeContextMenu } from "./use-node-context-menu";
import { useNodeSpotlight, type UseNodeSpotlightOptions } from "./use-node-spotlight";
import { usePanelEdit } from "./use-panel-edit";
import { useEventPollWiring } from "./use-event-poll-wiring";
import { useOverlayControls } from "./use-overlay-controls";
import { usePinnedImpact } from "./use-pinned-impact";
import { useRelTypes } from "./use-rel-types";
import { useSavedViewsWiring } from "./use-saved-views-wiring";
import { useSearchOverlay } from "./use-search-overlay";
import { useVersionsPanel } from "./use-versions-panel";

/** TASK-027: relationship labels the completeness overlay humanises
 * missing links against -- fetched once on mount (the design decision's
 * "boot-time types palette"; never re-fetched per toggle). A fetch failure
 * just means IRI-local-segment fallback labels (humanise-rel-name.ts),
 * never a hard error -- this is a labelling nicety, not the gate query
 * itself. */
function useRelationshipLabels(): OntologyRelationshipEntry[] {
  const [relationships, setRelationships] = useState<OntologyRelationshipEntry[]>([]);
  useEffect(() => {
    fetchOntologyTypes(15_000).then((result) => {
      if (result.type === "ok") setRelationships(result.relationships);
    });
  }, []);
  return relationships;
}

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
  fetchRelTypes?: () => Promise<RelKind[]>;
  /** TASK-023 AC-7: session role claim (getSessionClaims, resolved by
   * app/explorer/page.tsx's server shell) -- the UX-only half of
   * canEditCanvas; CE-WRITE-1 independently rejects server-side. */
  role?: string | null;
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


interface NodeInteractionOverlaysProps {
  resetLayout: (() => void) | undefined;
  panel: ReturnType<typeof useNodeSpotlight>["panel"];
  onClosePanel: () => void;
  onRetryPanel: () => void;
  search: ReturnType<typeof useSearchOverlay>;
  saveFailed: boolean;
  onDismissSaveFailure: () => void;
  /** TASK-024 AC-1..AC-8: property edit + delete, mounted into SidePanel. */
  panelEdit: ReturnType<typeof usePanelEdit>;
  canEdit: boolean;
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
  panelEdit,
  canEdit,
}: NodeInteractionOverlaysProps) {
  return (
    <>
      {resetLayout && (
        <Button
          variant="secondary"
          onClick={resetLayout}
          className="absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)]"
        >
          Reset layout
        </Button>
      )}
      <SidePanel state={panel} onClose={onClosePanel} onRetry={onRetryPanel} panelEdit={panelEdit} canEdit={canEdit} />
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

// TASK-020/022/026: canvas-chrome panels (filter/legend/overlay/versions/
// saved-views) all key off the same adapter+config -- split out so
// ExplorerInteractions itself stays under Law E's 50-line budget.
function useCanvasChromePanels(
  adapter: RendererAdapter,
  config: ExplorerConfig,
  fetchLayerNodes: UseFilterPanelOptions["fetchLayerNodes"],
  fetchPalette: ExplorerInteractionsProps["fetchPalette"],
  domainFocus: ReturnType<typeof useDomainFocus>,
  overlayControls: ReturnType<typeof useOverlayControls>
) {
  const filterPanel = useFilterPanel({ adapter, config, fetchLayerNodes });
  const legend = useCanvasLegend(fetchPalette);
  const versionsPanel = useVersionsPanel({ adapter, engine: overlayControls.engine });
  const savedViewsPanel = useSavedViewsWiring({ adapter, config, filterPanel, overlayControls, domainFocus });
  // AC-7: draft-mode-only polling -- never while pinned to a read-only version.
  useEventPollWiring({ adapter, config, active: !versionsPanel.readOnly });
  return { filterPanel, legend, versionsPanel, savedViewsPanel };
}

interface UseEditingStateOptions {
  adapter: RendererAdapter;
  config: ExplorerConfig;
  panel: ReturnType<typeof useNodeSpotlight>["panel"];
  role: string | null;
  chrome: ReturnType<typeof useCanvasChromePanels>;
  retry: () => void;
  close: () => void;
}

/** TASK-024 AC-1..AC-8: the canEditCanvas UX gate + usePanelEdit, bundled
 * so the property-edit/delete wiring is a single line in
 * ExplorerInteractions -- kept out to stay under Law E's 50-line budget.
 * retry re-fetches the panel node (an edit's new values render); close
 * drops the panel (a deleted node isn't left showing). */
function useEditingState({ adapter, config, panel, role, chrome, retry, close }: UseEditingStateOptions) {
  const canEdit = canEditCanvas({ role, isDraftCanvas: !chrome.versionsPanel.readOnly });
  const panelEdit = usePanelEdit({ adapter, config, panel, canEdit, onSaved: retry, onDeleted: close });
  return { canEdit, panelEdit };
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
  fetchRelTypes,
  role = null,
}: ExplorerInteractionsProps) {
  const overlayControls = useOverlayControls({ adapter, config });
  const relTypes = useRelTypes(fetchRelTypes);
  const relationships = useRelationshipLabels();
  const completenessOverlay = useCompletenessOverlay({
    adapter,
    engine: overlayControls.engine,
    timeoutMs: config.ceTimeoutMs,
    relationships,
  });
  // domainFocus + chrome move ahead of node-spotlight: canvasOverlayToggles
  // needs chrome.versionsPanel to derive impactEnabled before
  // useNodeSpotlight is called (refit deferred item 1).
  const domainFocus = useDomainFocus({ adapter, config, fetchDomainMembers });
  const chrome = useCanvasChromePanels(adapter, config, fetchLayerNodes, fetchPalette, domainFocus, overlayControls);
  const canvasOverlayToggles = useCanvasOverlayToggles({ completenessOverlay, versionsPanel: chrome.versionsPanel });
  const { panel, openNode, close, retry } = useNodeSpotlight({
    adapter,
    config,
    fetchNodeProps,
    gapIndex: completenessOverlay.gapIndex,
    impactEnabled: canvasOverlayToggles.impactEnabled,
  });
  useFocusParam(adapter, config, openNode);
  const search = useSearchOverlay({ adapter, config, onResultSelected: openNode });
  const neighbourExpansion = useNeighbourExpansion({ adapter, config });
  const { saveFailed, dismissSaveFailure, resetLayout } = useLayoutPersistence({ adapter, config, graphId: resolveGraphId(graphId, config) });
  const { menu, closeMenu } = useNodeContextMenu({ adapter, config, panel });
  const actions = useContextMenuActions(adapter, menu, panel.status === "loaded" ? panel.neighbours : [], domainFocus, neighbourExpansion);
  const confirmState = neighbourExpansion.state;
  usePinnedImpact({ adapter });
  // AC-7 UX layer -- CE-WRITE-1 independently rejects server-side regardless
  // of this flag (ADR-019). isDraftCanvas mirrors NodeInteractionOverlays'
  // own readOnly check above.
  const editing = useEditingState({ adapter, config, panel, role, chrome, retry, close });

  return (
    <>
      <CanvasFilterChrome
        adapter={adapter}
        onOpenSearch={search.openOverlay}
        filterPanel={chrome.filterPanel}
        legend={chrome.legend}
        overlayControls={overlayControls}
        versionsPanel={chrome.versionsPanel}
        savedViewsPanel={chrome.savedViewsPanel}
        canvasOverlayToggles={canvasOverlayToggles}
      />
      <CompletenessNotice
        notice={completenessOverlay.notice}
        error={completenessOverlay.error}
        onRetry={completenessOverlay.retry}
        onDismiss={completenessOverlay.toggle}
      />
      <NodeInteractionOverlays
        // TASK-022 AC-2: a published version is read-only -- no edit
        // affordances, so the drag-persisted "Reset layout" action is
        // hidden while pinned to one.
        resetLayout={chrome.versionsPanel.readOnly ? undefined : resetLayout}
        panel={panel}
        onClosePanel={close}
        onRetryPanel={retry}
        search={search}
        saveFailed={saveFailed}
        onDismissSaveFailure={dismissSaveFailure}
        panelEdit={editing.panelEdit}
        canEdit={editing.canEdit}
      />
      <ExpansionOverlays
        menu={menu}
        actions={actions}
        onCloseMenu={closeMenu}
        confirmState={confirmState}
        neighbourExpansion={neighbourExpansion}
        domainFocus={domainFocus}
      />
      <QuickAddOverlay adapter={adapter} config={config} canEdit={editing.canEdit} kinds={chrome.legend.palette} />
      <DrawEdgeOverlay adapter={adapter} config={config} canEdit={editing.canEdit} relTypes={relTypes} />
      <CanvasAskBar adapter={adapter} />
    </>
  );
}
