import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { NeighbourElement, RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useNeighbourExpansion } from "../use-neighbour-expansion";

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
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

function neighbour(iri: string): NeighbourElement {
  return {
    iri,
    label: iri,
    bpmoKind: "DataAsset",
    edgePredicate: "https://weave.example/ontology/bpmo#relatesTo",
    edgeDirection: "outgoing",
  };
}

describe("useNeighbourExpansion", () => {
  // AC-3: at or under the configured threshold, expansion happens
  // immediately -- no confirmation gate, no separate CE-READ-1 call.
  it("expands immediately when the new-node count is at or under the threshold", () => {
    const adapter = fakeAdapter();
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 5 };
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config }));

    act(() => result.current.requestExpand("n1", [neighbour("a"), neighbour("b")]));

    expect(adapter.expandNode).toHaveBeenCalledWith("n1", [neighbour("a"), neighbour("b")]);
    expect(result.current.state).toEqual({ status: "idle" });
  });

  // AC-4: over the threshold, expansion pauses for confirmation and does
  // NOT touch the canvas until the viewer confirms.
  it("requests confirmation instead of expanding when over the threshold", () => {
    const adapter = fakeAdapter();
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 1 };
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config }));

    act(() => result.current.requestExpand("n1", [neighbour("a"), neighbour("b")]));

    expect(adapter.expandNode).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({
      status: "confirm",
      nodeId: "n1",
      neighbours: [neighbour("a"), neighbour("b")],
      newCount: 2,
    });
  });

  // AC-4: nodes already present on the canvas don't count toward the
  // threshold -- expanding an already-visible neighbour is a no-op highlight.
  it("excludes already-present nodes from the new-node count", () => {
    const adapter = fakeAdapter({ listNodes: vi.fn(() => [{ id: "a", label: "a", typeLabel: "t", bpmoKind: "DataAsset" }]) });
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 1 };
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config }));

    act(() => result.current.requestExpand("n1", [neighbour("a"), neighbour("b")]));

    expect(adapter.expandNode).toHaveBeenCalledWith("n1", [neighbour("a"), neighbour("b")]);
  });

  // AC-4: confirming applies the paused expansion and returns to idle.
  it("applies the stored expansion and returns to idle on confirm", () => {
    const adapter = fakeAdapter();
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 1 };
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config }));

    act(() => result.current.requestExpand("n1", [neighbour("a"), neighbour("b")]));
    act(() => result.current.confirmExpand());

    expect(adapter.expandNode).toHaveBeenCalledWith("n1", [neighbour("a"), neighbour("b")]);
    expect(result.current.state).toEqual({ status: "idle" });
  });

  // AC-4: cancelling leaves the canvas untouched.
  it("cancels back to idle without touching the canvas", () => {
    const adapter = fakeAdapter();
    const config = { ...DEFAULT_EXPLORER_CONFIG, expandConfirmThreshold: 1 };
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config }));

    act(() => result.current.requestExpand("n1", [neighbour("a"), neighbour("b")]));
    act(() => result.current.cancelExpand());

    expect(adapter.expandNode).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: "idle" });
  });

  // AC-5: collapse is a direct, synchronous canvas call.
  it("collapses a node directly", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() => useNeighbourExpansion({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.collapse("n1"));

    expect(adapter.collapseNode).toHaveBeenCalledWith("n1");
  });
});
