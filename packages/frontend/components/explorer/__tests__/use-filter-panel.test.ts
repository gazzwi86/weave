import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { FetchLayerNodesResult } from "@/lib/explorer/fetch-layer-nodes";
import type { CytoscapeElement } from "@/lib/explorer/types";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useFilterPanel } from "../use-filter-panel";

function fakeAdapter(
  overrides: Partial<RendererAdapter> = {},
): RendererAdapter {
  return {
    load: vi.fn(),
    getViewport: vi.fn(() => ({ zoom: 1, pan: { x: 0, y: 0 } })),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(() => true),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    onNodeRightClick: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(() => undefined),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),    onEdgeDrawComplete: vi.fn(() => vi.fn()),

    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    onBackgroundDoubleClick: vi.fn(),
    listElements: vi.fn(() => []),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),    setBadges: vi.fn(),
    clearBadges: vi.fn(),    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

// n1 --relatesTo--> n2, both Process kind
const twoConnectedNodes: CytoscapeElement[] = [
  { data: { id: "n1", label: "Onboarding", bpmo_kind: "Process" } },
  { data: { id: "n2", label: "Offboarding", bpmo_kind: "Process" } },
  { data: { id: "e1", source: "n1", target: "n2", label: "relatesTo" } },
];

// V3b-3 item 1: a mixed-kind graph -- Process/BusinessDomain are landmark
// kinds (config.defaultVisibleKinds), System is not, so the seeded default
// filter should hide only n3.
const mixedKindNodes: CytoscapeElement[] = [
  { data: { id: "n1", label: "Onboarding", bpmo_kind: "Process" } },
  { data: { id: "n2", label: "Sales", bpmo_kind: "BusinessDomain" } },
  { data: { id: "n3", label: "CRM", bpmo_kind: "System" } },
];

describe("useFilterPanel", () => {
  it("hides a toggled-off entity type's nodes and incident edges (AC-1)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() => result.current.toggleEntityType("Process"));

    // e1's own incident-edge hide is the adapter's job (already covered by
    // applyFilterVisibility's hiddenNodeIds handling) -- computeFilterVisibility
    // deliberately excludes it from hiddenEdgeIds to avoid double-listing.
    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hiddenNodeIds: expect.arrayContaining(["n1", "n2"]),
      }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity,
    );
  });

  it("dims (does not remove) nodes orphaned by a relationship-type toggle (AC-3)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() => result.current.toggleRelType("relatesTo"));

    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hiddenNodeIds: [],
        dimmedNodeIds: expect.arrayContaining(["n1", "n2"]),
      }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity,
    );
  });

  it("AND-combines property filters, treating a missing path as non-matching (AC-4/AC-5)", () => {
    const withProps: CytoscapeElement[] = [
      {
        data: {
          id: "n1",
          bpmo_kind: "Process",
          key_properties: { status: "active", owner: "finance" },
        },
      },
      {
        data: {
          id: "n2",
          bpmo_kind: "Process",
          key_properties: { status: "active" },
        },
      },
    ];
    const adapter = fakeAdapter({ listElements: vi.fn(() => withProps) });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() =>
      result.current.setPropertyFilters([
        { path: "status", op: "eq", value: "active" },
        { path: "owner", op: "eq", value: "finance" },
      ]),
    );

    // n2 has no `owner` key -- AC-5's missing-path rule makes it non-matching,
    // even though its `status` filter alone would have matched.
    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ dimmedNodeIds: ["n2"] }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity,
    );
  });

  it("issues no network call when applying property filters (AC-4)", () => {
    const fetchLayerNodes = vi.fn();
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchLayerNodes,
      }),
    );

    act(() =>
      result.current.setPropertyFilters([
        { path: "status", op: "eq", value: "active" },
      ]),
    );

    expect(fetchLayerNodes).not.toHaveBeenCalled();
  });

  it("reports isEmpty once every entity type is toggled off (AC-2)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() => result.current.toggleEntityType("Process"));

    expect(result.current.visibility?.isEmpty).toBe(true);
  });

  it("exposes the distinct entity types and relationship types present on canvas (drives panel controls)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    expect(result.current.entityTypes).toEqual(["Process"]);
    expect(result.current.relTypes).toEqual(["relatesTo"]);
  });

  it("clears all toggled-off entity types in one call (AC-2 empty-state recovery)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() => result.current.toggleEntityType("Process"));
    expect(result.current.visibility?.isEmpty).toBe(true);

    act(() => result.current.clearEntityTypesOff());

    expect(result.current.filterState.entityTypesOff).toEqual([]);
    expect(result.current.visibility?.isEmpty).toBe(false);
  });

  it("fetches and overlays a governed layer's content on toggle-on (AC-6)", async () => {
    const layerElements: CytoscapeElement[] = [
      { data: { id: "https://weave.io/entity/term-1", label: "Revenue" } },
    ];
    const fetchLayerNodes = vi.fn<
      (...args: unknown[]) => Promise<FetchLayerNodesResult>
    >(() => Promise.resolve({ type: "ok", elements: layerElements }));
    const adapter = fakeAdapter({
      addLayerNodes: vi.fn(() => ["https://weave.io/entity/term-1"]),
    });
    const { result } = renderHook(() =>
      useFilterPanel({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchLayerNodes,
      }),
    );

    act(() => result.current.toggleLayer("glossary"));

    await waitFor(() =>
      expect(adapter.addLayerNodes).toHaveBeenCalledWith(layerElements),
    );
    expect(fetchLayerNodes).toHaveBeenCalledWith(
      "https://weave.io/ontology/Concept",
      undefined,
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs,
    );
    expect(result.current.layerStatus.glossary).toBe("on");
    expect(result.current.filterState.layersOn).toEqual(["glossary"]);
  });

  it("disables the toggle (no canvas mutation) when a governed layer is empty (AC-6)", async () => {
    const fetchLayerNodes = vi.fn<
      (...args: unknown[]) => Promise<FetchLayerNodesResult>
    >(() => Promise.resolve({ type: "empty" }));
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useFilterPanel({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchLayerNodes,
      }),
    );

    act(() => result.current.toggleLayer("brand"));

    await waitFor(() => expect(result.current.layerStatus.brand).toBe("empty"));
    expect(adapter.addLayerNodes).not.toHaveBeenCalled();
    expect(result.current.filterState.layersOn).toEqual([]);
  });

  it("removes exactly the elements a layer added when toggled back off (AC-6)", async () => {
    const layerElements: CytoscapeElement[] = [
      { data: { id: "https://weave.io/entity/term-1", label: "Revenue" } },
    ];
    const fetchLayerNodes = vi.fn<
      (...args: unknown[]) => Promise<FetchLayerNodesResult>
    >(() => Promise.resolve({ type: "ok", elements: layerElements }));
    const adapter = fakeAdapter({
      addLayerNodes: vi.fn(() => ["https://weave.io/entity/term-1"]),
    });
    const { result } = renderHook(() =>
      useFilterPanel({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        fetchLayerNodes,
      }),
    );

    act(() => result.current.toggleLayer("glossary"));
    await waitFor(() => expect(result.current.layerStatus.glossary).toBe("on"));

    act(() => result.current.toggleLayer("glossary"));

    expect(adapter.removeElements).toHaveBeenCalledWith([
      "https://weave.io/entity/term-1",
    ]);
    expect(result.current.layerStatus.glossary).toBe("off");
  });

  // TASK-026 AC-2: openView(view) replaces the whole FilterState in one
  // go (entity/rel/property filters directly, layersOn reconciled through
  // the existing toggleLayer side-effect path since layers need a fetch).
  it("replaceFilterState sets plain fields directly and reconciles layersOn via toggleLayer (TASK-026 AC-2)", async () => {
    const layerElements: CytoscapeElement[] = [{ data: { id: "https://weave.io/entity/term-1", label: "Revenue" } }];
    const fetchLayerNodes = vi.fn<(...args: unknown[]) => Promise<FetchLayerNodesResult>>(() =>
      Promise.resolve({ type: "ok", elements: layerElements })
    );
    const adapter = fakeAdapter({ addLayerNodes: vi.fn(() => ["https://weave.io/entity/term-1"]) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchLayerNodes }));

    act(() => {
      result.current.replaceFilterState({
        entityTypesOff: ["Process"],
        relTypesOff: ["relatesTo"],
        propertyFilters: [{ path: "status", op: "eq", value: "active" }],
        layersOn: ["glossary"],
      });
    });

    expect(result.current.filterState.entityTypesOff).toEqual(["Process"]);
    expect(result.current.filterState.relTypesOff).toEqual(["relatesTo"]);
    expect(result.current.filterState.propertyFilters).toEqual([{ path: "status", op: "eq", value: "active" }]);
    await waitFor(() => expect(result.current.layerStatus.glossary).toBe("on"));
    expect(adapter.addLayerNodes).toHaveBeenCalledWith(layerElements);
  });

  // V3b-3 item 1: on first load, kinds outside config.defaultVisibleKinds
  // start toggled off -- a hundreds-of-node demo workspace opens legible
  // instead of a hairball, while landmark kinds (Process/BusinessDomain)
  // stay visible.
  it("seeds entityTypesOff with non-landmark kinds on first load (V3b-3 default filter)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => mixedKindNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    expect(result.current.filterState.entityTypesOff).toEqual(["System"]);
  });

  // V3b-3 item 1: "show all" is one click away -- the existing empty-state
  // recovery action already clears entityTypesOff in one call, and it works
  // the same for a seeded default as it does for a fully-manual toggle-off.
  it("clearEntityTypesOff shows every kind, including the seeded default (V3b-3)", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => mixedKindNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    expect(result.current.filterState.entityTypesOff).toEqual(["System"]);

    act(() => result.current.clearEntityTypesOff());

    expect(result.current.filterState.entityTypesOff).toEqual([]);
  });

  // V3b-3 item 1: the seed only ever fires once -- a user who clears the
  // default and then toggles a kind back off manually keeps their own
  // choice; the seed effect must not re-clobber it on a later render.
  it("does not re-seed after the user has changed entityTypesOff themselves", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => mixedKindNodes),
    });
    const { result } = renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    act(() => result.current.clearEntityTypesOff());
    act(() => result.current.toggleEntityType("Process"));

    expect(result.current.filterState.entityTypesOff).toEqual(["Process"]);
  });

  // AC-7: records the single applyFilterVisibility batch call's wall-clock
  // duration on window for the Playwright perf spec to read -- see
  // explorer-filters-layers.spec.ts's "filter apply p95" test.
  it("records the applyFilterVisibility batch call's duration for the AC-7 perf trace", () => {
    const adapter = fakeAdapter({
      listElements: vi.fn(() => twoConnectedNodes),
    });

    renderHook(() =>
      useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }),
    );

    expect(typeof window.__explorerFilterApplyDurationMs).toBe("number");
  });
});
