"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { computeFilterVisibility, type FilterVisibilityResult } from "@/lib/explorer/compute-filter-visibility";
import type { ExplorerConfig } from "@/lib/explorer/config";
import {
  createFilterState,
  type FilterState,
  type GovernedLayer,
  type PropertyFilter,
} from "@/lib/explorer/filter-state";
import { fetchLayerNodes as defaultFetchLayerNodes, type FetchLayerNodesResult } from "@/lib/explorer/fetch-layer-nodes";
import { WEAVE_ONTOLOGY_NS } from "@/lib/explorer/map-rows-to-elements";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export type LayerStatus = "off" | "on" | "empty";

export interface UseFilterPanelOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** Test seam -- defaults to the real CE-READ-1 proxy fetch. */
  fetchLayerNodes?: (
    kindIri: string,
    governedByPredicate: string | undefined,
    timeoutMs: number
  ) => Promise<FetchLayerNodesResult>;
}

export interface UseFilterPanelResult {
  filterState: FilterState;
  /** null until the first recompute (adapter not ready yet). */
  visibility: FilterVisibilityResult | null;
  layerStatus: Record<GovernedLayer, LayerStatus>;
  toggleEntityType: (kindIri: string) => void;
  toggleRelType: (predicateIri: string) => void;
  setPropertyFilters: (filters: PropertyFilter[]) => void;
  toggleLayer: (layer: GovernedLayer) => void;
}

const EMPTY_LAYER_STATUS: Record<GovernedLayer, LayerStatus> = { glossary: "off", brand: "off", governance: "off" };

// AC-6: kind local names live in config (glossaryLayerKind: "Concept" etc)
// -- this is the one place they're joined onto the ontology namespace into
// the absolute IRI fetchLayerNodes/buildLayerQuery require. An unset local
// name (brandLayerKind's tenant-configured default) stays "" rather than
// becoming a bogus bare-namespace IRI.
const LAYER_KIND_CONFIG_KEY = {
  glossary: "glossaryLayerKind",
  governance: "governanceLayerKind",
  brand: "brandLayerKind",
} as const satisfies Record<GovernedLayer, keyof ExplorerConfig>;

function layerKindIri(layer: GovernedLayer, config: ExplorerConfig): string {
  const localName = config[LAYER_KIND_CONFIG_KEY[layer]] as string;
  return localName ? `${WEAVE_ONTOLOGY_NS}${localName}` : "";
}

// AC-6: only Governance carries a governedBy edge predicate -- Glossary/
// Brand pass undefined so buildLayerQuery omits the OPTIONAL clause.
function layerPredicate(layer: GovernedLayer, config: ExplorerConfig): string | undefined {
  return layer === "governance" ? config.governanceLayerPredicate : undefined;
}

function toggleArrayValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

// AC-1/AC-2/AC-3/AC-4/AC-5/AC-7: visibility is derived from the adapter's
// live element set (useMemo, not effect-owned state, so a toggle never
// risks a cascading re-render) -- applying it to the canvas is the one
// external-system sync this hook owns.
function useAppliedVisibility(
  adapter: RendererAdapter | null,
  filterState: FilterState,
  dimOpacity: number
): FilterVisibilityResult | null {
  const visibility = useMemo<FilterVisibilityResult | null>(() => {
    if (!adapter) return null;
    return computeFilterVisibility(adapter.listElements(), filterState);
  }, [adapter, filterState]);

  useEffect(() => {
    if (!adapter || !visibility) return;
    adapter.applyFilterVisibility(visibility, dimOpacity);
  }, [adapter, visibility, dimOpacity]);

  return visibility;
}

/** TASK-020: owns FilterState. Every toggle/property-filter/layer change
 * recomputes computeFilterVisibility over the adapter's live element set
 * and applies it in one batch (AC-1/AC-2/AC-3/AC-4/AC-5/AC-7). Governed-
 * content layers (AC-6) fetch via CE-READ-1 (fetch-layer-nodes.ts), then
 * mutate the canvas only through the addLayerNodes/removeElements adapter
 * seam (ADR-014) -- never cytoscape directly. */
export function useFilterPanel({
  adapter,
  config,
  fetchLayerNodes = defaultFetchLayerNodes,
}: UseFilterPanelOptions): UseFilterPanelResult {
  const [filterState, setFilterState] = useState<FilterState>(createFilterState);
  const [layerStatus, setLayerStatus] = useState<Record<GovernedLayer, LayerStatus>>(EMPTY_LAYER_STATUS);
  // Ids each layer added, so toggling off removes exactly what was added
  // (shared-with-base-graph ids, deduped by addLayerNodes, are never here).
  const layerElementIdsRef = useRef<Record<GovernedLayer, string[]>>({ glossary: [], brand: [], governance: [] });
  const visibility = useAppliedVisibility(adapter, filterState, config.spotlightDimOpacity);

  const toggleEntityType = useCallback((kindIri: string) => {
    setFilterState((state) => ({ ...state, entityTypesOff: toggleArrayValue(state.entityTypesOff, kindIri) }));
  }, []);

  const toggleRelType = useCallback((predicateIri: string) => {
    setFilterState((state) => ({ ...state, relTypesOff: toggleArrayValue(state.relTypesOff, predicateIri) }));
  }, []);

  const setPropertyFilters = useCallback((filters: PropertyFilter[]) => {
    setFilterState((state) => ({ ...state, propertyFilters: filters }));
  }, []);

  const turnLayerOff = useCallback((layer: GovernedLayer, adapterRef: RendererAdapter) => {
    adapterRef.removeElements(layerElementIdsRef.current[layer]);
    layerElementIdsRef.current[layer] = [];
    setLayerStatus((prev) => ({ ...prev, [layer]: "off" }));
    setFilterState((state) => ({ ...state, layersOn: state.layersOn.filter((l) => l !== layer) }));
  }, []);

  const turnLayerOn = useCallback(
    (layer: GovernedLayer, adapterRef: RendererAdapter) => {
      fetchLayerNodes(layerKindIri(layer, config), layerPredicate(layer, config), config.ceTimeoutMs).then((result) => {
        if (result.type !== "ok" || result.elements.length === 0) {
          setLayerStatus((prev) => ({ ...prev, [layer]: "empty" }));
          return;
        }
        layerElementIdsRef.current[layer] = adapterRef.addLayerNodes(result.elements);
        setLayerStatus((prev) => ({ ...prev, [layer]: "on" }));
        setFilterState((state) => ({ ...state, layersOn: [...state.layersOn, layer] }));
      });
    },
    [config, fetchLayerNodes]
  );

  const toggleLayer = useCallback(
    (layer: GovernedLayer) => {
      if (!adapter) return;
      if (filterState.layersOn.includes(layer)) turnLayerOff(layer, adapter);
      else turnLayerOn(layer, adapter);
    },
    [adapter, filterState.layersOn, turnLayerOff, turnLayerOn]
  );

  return { filterState, visibility, layerStatus, toggleEntityType, toggleRelType, setPropertyFilters, toggleLayer };
}
