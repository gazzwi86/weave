"use client";

import { useCallback, useState } from "react";

import {
  fetchLayoutPositions as defaultFetchLayoutPositions,
  type SavedLayoutPosition,
} from "@/lib/explorer/layout-client";
import type { FilterState } from "@/lib/explorer/filter-state";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import { buildSaveViewBody, computeMissingEntityIds } from "@/lib/explorer/saved-view-state";
import {
  deleteView as defaultDeleteView,
  listViews as defaultListViews,
  saveView as defaultSaveView,
  shareView as defaultShareView,
  type SaveViewResult,
  type ShareResult,
  type ViewSummary,
} from "@/lib/explorer/views-client";

export interface UseSavedViewsOptions {
  adapter: RendererAdapter | null;
  filterState: FilterState;
  activeOverlayIds: string[];
  domainFocus: string | null;
  setFilterState: (filterState: FilterState) => void;
  setActiveOverlayIds: (ids: string[]) => void;
  setDomainFocus: (iri: string | null) => void;
  /** Re-fetches + re-renders the draft graph (owned by use-explorer-canvas). */
  reloadGraph: () => Promise<void>;
  /** Node ids currently on the canvas, post-reload -- used for AC-3's
   * missing-entity notice. */
  loadedNodeIds: () => ReadonlySet<string>;
  saveView?: typeof defaultSaveView;
  listViews?: typeof defaultListViews;
  deleteView?: typeof defaultDeleteView;
  shareView?: typeof defaultShareView;
  fetchLayoutPositions?: typeof defaultFetchLayoutPositions;
}

export interface UseSavedViewsResult {
  views: ViewSummary[];
  refreshLibrary: () => Promise<void>;
  save: (name: string, overwrite?: boolean) => Promise<SaveViewResult>;
  open: (view: ViewSummary) => Promise<{ missingCount: number }>;
  remove: (viewId: string) => Promise<boolean>;
  share: (viewId: string, recipients: string[]) => Promise<ShareResult | null>;
}

interface ApplyOpenedViewDeps {
  adapter: RendererAdapter | null;
  reloadGraph: () => Promise<void>;
  setFilterState: (filterState: FilterState) => void;
  setActiveOverlayIds: (ids: string[]) => void;
  setDomainFocus: (iri: string | null) => void;
}

// AC-2: positions applied before overlays/filters/viewport (pseudocode's
// explicit ordering rule) -- reloadGraph() is a black box here (owned by
// use-explorer-canvas), so this assumes it doesn't re-run fcose after this
// function returns; see TASK-026 summary for the caveat.
async function applyOpenedView(
  view: ViewSummary,
  positions: SavedLayoutPosition[],
  deps: ApplyOpenedViewDeps
): Promise<void> {
  await deps.reloadGraph();
  if (deps.adapter) {
    const positionMap = Object.fromEntries(positions.map((p) => [p.node_iri, { x: p.position_x, y: p.position_y }]));
    deps.adapter.applyPositions(positionMap);
  }
  deps.setFilterState(view.definition.filterState);
  deps.setActiveOverlayIds(view.definition.activeOverlayIds);
  deps.setDomainFocus(view.definition.domainFocus);
  deps.adapter?.setViewport(view.definition.viewport);
}

/** TASK-026 AC-1/AC-2/AC-3/AC-4/AC-5: save/open/library/delete/share for
 * saved views -- pure DI over the canvas so it's testable without a real
 * cytoscape instance or fetch-graph pipeline. */
// Split out of useSavedViews to keep that hook under Law E's 50-line
// function budget (same sibling-hook pattern as use-versions-panel.ts).
function useSaveAndOpen(
  opts: UseSavedViewsOptions,
  saveView: typeof defaultSaveView,
  fetchLayoutPositions: typeof defaultFetchLayoutPositions,
  refreshLibrary: () => Promise<void>
): { save: UseSavedViewsResult["save"]; open: UseSavedViewsResult["open"] } {
  const { adapter, filterState, activeOverlayIds, domainFocus, reloadGraph, setFilterState, setActiveOverlayIds, setDomainFocus, loadedNodeIds } =
    opts;

  const save = useCallback(
    async (name: string, overwrite = false) => {
      const body = buildSaveViewBody({
        name,
        overwrite,
        definition: { filterState, activeOverlayIds, domainFocus, viewport: adapter?.getViewport() ?? { zoom: 1, pan: { x: 0, y: 0 } } },
        positions: adapter?.allNodePositions() ?? {},
      });
      const result = await saveView(body);
      if (result.status === "created") await refreshLibrary();
      return result;
    },
    [adapter, filterState, activeOverlayIds, domainFocus, saveView, refreshLibrary]
  );

  const open = useCallback(
    async (view: ViewSummary) => {
      const positions = await fetchLayoutPositions(`view:${view.view_id}`);
      await applyOpenedView(view, positions, { adapter, reloadGraph, setFilterState, setActiveOverlayIds, setDomainFocus });
      const positionIris = positions.map((p) => p.node_iri);
      const missing = computeMissingEntityIds(view.definition, positionIris, loadedNodeIds());
      return { missingCount: missing.length };
    },
    [adapter, reloadGraph, setFilterState, setActiveOverlayIds, setDomainFocus, loadedNodeIds, fetchLayoutPositions]
  );

  return { save, open };
}

export function useSavedViews(opts: UseSavedViewsOptions): UseSavedViewsResult {
  const {
    deleteView = defaultDeleteView,
    listViews = defaultListViews,
    shareView = defaultShareView,
    saveView = defaultSaveView,
    fetchLayoutPositions = defaultFetchLayoutPositions,
  } = opts;
  const [views, setViews] = useState<ViewSummary[]>([]);

  const refreshLibrary = useCallback(async () => {
    setViews(await listViews());
  }, [listViews]);

  const { save, open } = useSaveAndOpen(opts, saveView, fetchLayoutPositions, refreshLibrary);

  const remove = useCallback(
    async (viewId: string) => {
      const ok = await deleteView(viewId);
      if (ok) await refreshLibrary();
      return ok;
    },
    [deleteView, refreshLibrary]
  );

  const share = useCallback((viewId: string, recipients: string[]) => shareView(viewId, recipients), [shareView]);

  return { views, refreshLibrary, save, open, remove, share };
}
