import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { RelKind } from "@/lib/explorer/types";

import { DrawEdgeOverlay } from "../draw-edge-overlay";

const REL_TYPES: RelKind[] = [{ id: "performs", label: "Performs" }];

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
    onBackgroundDoubleClick: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(() => undefined),
    listNodes: vi.fn(() => []),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    onEdgeDrawComplete: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    listElements: vi.fn(() => []),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

describe("DrawEdgeOverlay", () => {
  it("renders nothing (no picker) when no drag has completed yet", () => {
    render(<DrawEdgeOverlay adapter={fakeAdapter()} config={DEFAULT_EXPLORER_CONFIG} canEdit relTypes={REL_TYPES} />);
    expect(screen.queryByLabelText("Choose relationship")).not.toBeInTheDocument();
  });

  it("never opens the picker when canEdit is false, even on a completed drag", () => {
    let complete: ((sourceId: string, targetId: string) => void) | undefined;
    const onEdgeDrawComplete = vi.fn((handler: (sourceId: string, targetId: string) => void) => {
      complete = handler;
      return vi.fn();
    });
    render(<DrawEdgeOverlay adapter={fakeAdapter({ onEdgeDrawComplete })} config={DEFAULT_EXPLORER_CONFIG} canEdit={false} relTypes={REL_TYPES} />);
    complete?.("n1", "n2");
    expect(screen.queryByLabelText("Choose relationship")).not.toBeInTheDocument();
  });
});
