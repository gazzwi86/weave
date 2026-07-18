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

declare global {
  interface Window {
    /** Playwright-only introspection hook (AC-7 perf spec) -- wall-clock ms
     * of the single adapter.applyFilterVisibility batch call a toggle
     * triggers, measured in-browser via performance.now() so IPC
     * round-trips don't skew the reading. Dev-only, never in production. */
    __explorerFilterApplyDurationMs?: number;
  }
}

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
  /** Distinct kind tokens / predicate IRIs present on canvas -- drives the
   * panel's toggle lists (a toggled-off type stays listed, since hiding is
   * a style change, never a listElements() removal). */
  entityTypes: string[];
  relTypes: string[];
  layerStatus: Record<GovernedLayer, LayerStatus>;
  toggleEntityType: (kindIri: string) => void;
  toggleRelType: (predicateIri: string) => void;
  /** AC-2 empty-state recovery: the "all entity types off" empty-state's
   * fix action -- restores every type in one setState rather than making
   * the caller toggle each one back on individually. */
  clearEntityTypesOff: () => void;
  setPropertyFilters: (filters: PropertyFilter[]) => void;
  toggleLayer: (layer: GovernedLayer) => void;
  /** TASK-026 AC-2: openView(view) restores a whole saved FilterState in
   * one call. Plain fields are set directly; layersOn is reconciled via
   * the existing toggleLayer side-effect path (layers need a CE-READ-1
   * fetch, not just a state write). */
  replaceFilterState: (next: FilterState) => void;
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

function distinctSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}

interface AppliedVisibility {
  visibility: FilterVisibilityResult | null;
  entityTypes: string[];
  relTypes: string[];
}

// AC-1/AC-2/AC-3/AC-4/AC-5/AC-7: visibility (and the panel's toggle lists)
// are derived from the adapter's live element set in one useMemo (not
// effect-owned state, so a toggle never risks a cascading re-render) --
// applying visibility to the canvas is the one external-system sync this
// hook owns.
function useAppliedVisibility(
  adapter: RendererAdapter | null,
  filterState: FilterState,
  dimOpacity: number
): AppliedVisibility {
  const applied = useMemo<AppliedVisibility>(() => {
    if (!adapter) return { visibility: null, entityTypes: [], relTypes: [] };
    const elements = adapter.listElements();
    return {
      visibility: computeFilterVisibility(elements, filterState),
      entityTypes: distinctSorted(elements.map((el) => el.data.bpmo_kind)),
      relTypes: distinctSorted(elements.filter((el) => el.data.source !== undefined).map((el) => el.data.label)),
    };
  }, [adapter, filterState]);

  useEffect(() => {
    if (!adapter || !applied.visibility) return;
    const startedAt = performance.now();
    adapter.applyFilterVisibility(applied.visibility, dimOpacity);
    // AC-7 perf trace -- dev-only, see the __explorerFilterApplyDurationMs
    // hook doc comment above.
    if (process.env.NODE_ENV !== "production") window.__explorerFilterApplyDurationMs = performance.now() - startedAt;
  }, [adapter, applied.visibility, dimOpacity]);

  return applied;
}

interface LayerToggle {
  layerStatus: Record<GovernedLayer, LayerStatus>;
  toggleLayer: (layer: GovernedLayer) => void;
}

// AC-6: fetches a governed layer via CE-READ-1 and mutates the canvas only
// through the addLayerNodes/removeElements adapter seam (ADR-014). Split out
// of useFilterPanel to keep that hook under the Law E line budget.
function useLayerToggle(
  adapter: RendererAdapter | null,
  filterState: FilterState,
  setFilterState: (updater: (state: FilterState) => FilterState) => void,
  config: ExplorerConfig,
  fetchLayerNodes: NonNullable<UseFilterPanelOptions["fetchLayerNodes"]>
): LayerToggle {
  const [layerStatus, setLayerStatus] = useState<Record<GovernedLayer, LayerStatus>>(EMPTY_LAYER_STATUS);
  // Ids each layer added, so toggling off removes exactly what was added
  // (shared-with-base-graph ids, deduped by addLayerNodes, are never here).
  const layerElementIdsRef = useRef<Record<GovernedLayer, string[]>>({ glossary: [], brand: [], governance: [] });

  const turnLayerOff = useCallback(
    (layer: GovernedLayer, adapterRef: RendererAdapter) => {
      adapterRef.removeElements(layerElementIdsRef.current[layer]);
      layerElementIdsRef.current[layer] = [];
      setLayerStatus((prev) => ({ ...prev, [layer]: "off" }));
      setFilterState((state) => ({ ...state, layersOn: state.layersOn.filter((l) => l !== layer) }));
    },
    [setFilterState]
  );

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
    [config, fetchLayerNodes, setFilterState]
  );

  const toggleLayer = useCallback(
    (layer: GovernedLayer) => {
      if (!adapter) return;
      if (filterState.layersOn.includes(layer)) turnLayerOff(layer, adapter);
      else turnLayerOn(layer, adapter);
    },
    [adapter, filterState.layersOn, turnLayerOff, turnLayerOn]
  );

  return { layerStatus, toggleLayer };
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
  const { visibility, entityTypes, relTypes } = useAppliedVisibility(adapter, filterState, config.spotlightDimOpacity);
  const { layerStatus, toggleLayer } = useLayerToggle(adapter, filterState, setFilterState, config, fetchLayerNodes);

  // V3b-3 item 1: seeds a default filter once, the first time entity kinds
  // are known, so a hundreds-of-node demo workspace opens legible instead of
  // a hairball. Render-phase setState (react.dev "adjusting state when props
  // change"), not an effect, so it lands in the same commit with no extra
  // render round-trip -- state (not a ref) tracks "seeded", since
  // react-hooks/refs disallows reading ref.current during render. Fires
  // only once ever, so it never re-clobbers a user's own filter choice --
  // including across a later adapter swap (e.g. version switch/retry);
  // re-seeding then is an accepted M1 ceiling.
  const [seededDefault, setSeededDefault] = useState(false);
  if (!seededDefault && adapter && entityTypes.length > 0) {
    setSeededDefault(true);
    const offByDefault = entityTypes.filter((kind) => !config.defaultVisibleKinds.includes(kind));
    if (offByDefault.length > 0) setFilterState((state) => ({ ...state, entityTypesOff: offByDefault }));
  }

  const toggleEntityType = useCallback((kindIri: string) => {
    setFilterState((state) => ({ ...state, entityTypesOff: toggleArrayValue(state.entityTypesOff, kindIri) }));
  }, []);

  const toggleRelType = useCallback((predicateIri: string) => {
    setFilterState((state) => ({ ...state, relTypesOff: toggleArrayValue(state.relTypesOff, predicateIri) }));
  }, []);

  const clearEntityTypesOff = useCallback(() => {
    setFilterState((state) => ({ ...state, entityTypesOff: [] }));
  }, []);

  const setPropertyFilters = useCallback((filters: PropertyFilter[]) => {
    setFilterState((state) => ({ ...state, propertyFilters: filters }));
  }, []);

  const replaceFilterState = useCallback(
    (next: FilterState) => {
      setFilterState((state) => ({ ...state, entityTypesOff: next.entityTypesOff, relTypesOff: next.relTypesOff, propertyFilters: next.propertyFilters }));
      for (const layer of ["glossary", "brand", "governance"] as GovernedLayer[]) {
        if (next.layersOn.includes(layer) !== filterState.layersOn.includes(layer)) toggleLayer(layer);
      }
    },
    [filterState.layersOn, toggleLayer]
  );

  return {
    filterState,
    visibility,
    entityTypes,
    relTypes,
    layerStatus,
    toggleEntityType,
    toggleRelType,
    clearEntityTypesOff,
    setPropertyFilters,
    toggleLayer,
    replaceFilterState,
  };
}
