import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { FetchLayerNodesResult } from "@/lib/explorer/fetch-layer-nodes";
import type { CytoscapeElement } from "@/lib/explorer/types";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useFilterPanel } from "../use-filter-panel";

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
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
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    listElements: vi.fn(() => []),
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

describe("useFilterPanel", () => {
  it("hides a toggled-off entity type's nodes and incident edges (AC-1)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.toggleEntityType("Process"));

    // e1's own incident-edge hide is the adapter's job (already covered by
    // applyFilterVisibility's hiddenNodeIds handling) -- computeFilterVisibility
    // deliberately excludes it from hiddenEdgeIds to avoid double-listing.
    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ hiddenNodeIds: expect.arrayContaining(["n1", "n2"]) }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity
    );
  });

  it("dims (does not remove) nodes orphaned by a relationship-type toggle (AC-3)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.toggleRelType("relatesTo"));

    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ hiddenNodeIds: [], dimmedNodeIds: expect.arrayContaining(["n1", "n2"]) }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity
    );
  });

  it("AND-combines property filters, treating a missing path as non-matching (AC-4/AC-5)", () => {
    const withProps: CytoscapeElement[] = [
      { data: { id: "n1", bpmo_kind: "Process", key_properties: { status: "active", owner: "finance" } } },
      { data: { id: "n2", bpmo_kind: "Process", key_properties: { status: "active" } } },
    ];
    const adapter = fakeAdapter({ listElements: vi.fn(() => withProps) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() =>
      result.current.setPropertyFilters([
        { path: "status", op: "eq", value: "active" },
        { path: "owner", op: "eq", value: "finance" },
      ])
    );

    // n2 has no `owner` key -- AC-5's missing-path rule makes it non-matching,
    // even though its `status` filter alone would have matched.
    expect(adapter.applyFilterVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ dimmedNodeIds: ["n2"] }),
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity
    );
  });

  it("issues no network call when applying property filters (AC-4)", () => {
    const fetchLayerNodes = vi.fn();
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchLayerNodes }));

    act(() => result.current.setPropertyFilters([{ path: "status", op: "eq", value: "active" }]));

    expect(fetchLayerNodes).not.toHaveBeenCalled();
  });

  it("reports isEmpty once every entity type is toggled off (AC-2)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.toggleEntityType("Process"));

    expect(result.current.visibility?.isEmpty).toBe(true);
  });

  it("exposes the distinct entity types and relationship types present on canvas (drives panel controls)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    expect(result.current.entityTypes).toEqual(["Process"]);
    expect(result.current.relTypes).toEqual(["relatesTo"]);
  });

  it("clears all toggled-off entity types in one call (AC-2 empty-state recovery)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => twoConnectedNodes) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.toggleEntityType("Process"));
    expect(result.current.visibility?.isEmpty).toBe(true);

    act(() => result.current.clearEntityTypesOff());

    expect(result.current.filterState.entityTypesOff).toEqual([]);
    expect(result.current.visibility?.isEmpty).toBe(false);
  });

  it("fetches and overlays a governed layer's content on toggle-on (AC-6)", async () => {
    const layerElements: CytoscapeElement[] = [{ data: { id: "https://weave.io/entity/term-1", label: "Revenue" } }];
    const fetchLayerNodes = vi.fn<(...args: unknown[]) => Promise<FetchLayerNodesResult>>(() =>
      Promise.resolve({ type: "ok", elements: layerElements })
    );
    const adapter = fakeAdapter({ addLayerNodes: vi.fn(() => ["https://weave.io/entity/term-1"]) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchLayerNodes }));

    act(() => result.current.toggleLayer("glossary"));

    await waitFor(() => expect(adapter.addLayerNodes).toHaveBeenCalledWith(layerElements));
    expect(fetchLayerNodes).toHaveBeenCalledWith(
      "https://weave.io/ontology/Concept",
      undefined,
      DEFAULT_EXPLORER_CONFIG.ceTimeoutMs
    );
    expect(result.current.layerStatus.glossary).toBe("on");
    expect(result.current.filterState.layersOn).toEqual(["glossary"]);
  });

  it("disables the toggle (no canvas mutation) when a governed layer is empty (AC-6)", async () => {
    const fetchLayerNodes = vi.fn<(...args: unknown[]) => Promise<FetchLayerNodesResult>>(() =>
      Promise.resolve({ type: "empty" })
    );
    const adapter = fakeAdapter();
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchLayerNodes }));

    act(() => result.current.toggleLayer("brand"));

    await waitFor(() => expect(result.current.layerStatus.brand).toBe("empty"));
    expect(adapter.addLayerNodes).not.toHaveBeenCalled();
    expect(result.current.filterState.layersOn).toEqual([]);
  });

  it("removes exactly the elements a layer added when toggled back off (AC-6)", async () => {
    const layerElements: CytoscapeElement[] = [{ data: { id: "https://weave.io/entity/term-1", label: "Revenue" } }];
    const fetchLayerNodes = vi.fn<(...args: unknown[]) => Promise<FetchLayerNodesResult>>(() =>
      Promise.resolve({ type: "ok", elements: layerElements })
    );
    const adapter = fakeAdapter({ addLayerNodes: vi.fn(() => ["https://weave.io/entity/term-1"]) });
    const { result } = renderHook(() => useFilterPanel({ adapter, config: DEFAULT_EXPLORER_CONFIG, fetchLayerNodes }));

    act(() => result.current.toggleLayer("glossary"));
    await waitFor(() => expect(result.current.layerStatus.glossary).toBe("on"));

    act(() => result.current.toggleLayer("glossary"));

    expect(adapter.removeElements).toHaveBeenCalledWith(["https://weave.io/entity/term-1"]);
    expect(result.current.layerStatus.glossary).toBe("off");
  });
});
