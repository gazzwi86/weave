"use client";

import { useCallback } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { fetchGraph as defaultFetchGraph } from "@/lib/explorer/fetch-graph";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import type { UseDomainFocusResult } from "./use-domain-focus";
import type { UseFilterPanelResult } from "./use-filter-panel";
import type { UseOverlayControlsResult } from "./use-overlay-controls";
import { useSavedViews, type UseSavedViewsResult } from "./use-saved-views";

export interface UseSavedViewsWiringOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  filterPanel: UseFilterPanelResult;
  overlayControls: UseOverlayControlsResult;
  domainFocus: UseDomainFocusResult;
  /** Test seam -- defaults real CE-READ-1 proxy fetch. */
  fetchGraph?: (timeoutMs: number) => ReturnType<typeof defaultFetchGraph>;
}

// Pure reconciliation logic, exported for direct unit testing without
// needing to drive it through the real useSavedViews/open() network path.
export function reconcileActiveOverlays(
  toggles: UseOverlayControlsResult["toggles"],
  toggleOverlay: UseOverlayControlsResult["toggleOverlay"],
  targetIds: string[]
): void {
  for (const toggle of toggles) {
    if (targetIds.includes(toggle.id) !== toggle.active) toggleOverlay(toggle.id);
  }
}

export function applyDomainFocus(domainFocus: UseDomainFocusResult, iri: string | null): void {
  if (iri) domainFocus.focusDomain(iri);
  else domainFocus.clearFocus();
}

// TASK-026: glues the four canvas-owning hooks (filter/overlay/domain-focus)
// into UseSavedViewsOptions' shape, so ExplorerInteractions itself doesn't
// carry this wiring inline (keeps it under Law E's file-length budget).
// reloadGraph re-fetches + adapter.load()s directly rather than routing
// through use-explorer-canvas's own retryToken effect -- that hook lives a
// level up (owns the initial mount), out of ExplorerInteractions' reach.
export function useSavedViewsWiring({
  adapter,
  config,
  filterPanel,
  overlayControls,
  domainFocus,
  fetchGraph = defaultFetchGraph,
}: UseSavedViewsWiringOptions): UseSavedViewsResult {
  const reloadGraph = useCallback(async () => {
    if (!adapter) return;
    adapter.load(await fetchGraph(config.ceTimeoutMs));
  }, [adapter, config.ceTimeoutMs, fetchGraph]);

  const setActiveOverlayIds = useCallback(
    (ids: string[]) => reconcileActiveOverlays(overlayControls.toggles, overlayControls.toggleOverlay, ids),
    [overlayControls]
  );

  const setDomainFocus = useCallback((iri: string | null) => applyDomainFocus(domainFocus, iri), [domainFocus]);

  const loadedNodeIds = useCallback(() => new Set(adapter?.listNodes().map((n) => n.id) ?? []), [adapter]);

  return useSavedViews({
    adapter,
    filterState: filterPanel.filterState,
    activeOverlayIds: overlayControls.toggles.filter((t) => t.active).map((t) => t.id),
    domainFocus: domainFocus.domainIri,
    setFilterState: filterPanel.replaceFilterState,
    setActiveOverlayIds,
    setDomainFocus,
    reloadGraph,
    loadedNodeIds,
  });
}
