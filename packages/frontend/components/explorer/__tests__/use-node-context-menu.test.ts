import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import type { SidePanelState } from "../use-node-spotlight";
import { useNodeContextMenu } from "../use-node-context-menu";

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
    onNodeDragEnd: vi.fn(() => vi.fn()),
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    onBackgroundDoubleClick: vi.fn(),
    listElements: vi.fn(() => []),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

const LOADED_PANEL: SidePanelState = {
  status: "loaded",
  label: "Invoicing",
  typeLabel: "Process",
  keyProperties: [],
  rawIri: null,
  nodeId: "n1",
  neighbours: [],
};

const CLOSED_PANEL: SidePanelState = { status: "closed" };

describe("useNodeContextMenu", () => {
  // AC-3/AC-5: right-click on the currently spotlighted node opens the menu,
  // with canFocusDomain/isExpanded read from the renderer-adapter seam.
  it("opens the menu for the currently spotlighted node with canFocusDomain and isExpanded populated", () => {
    let rightClickHandler:
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;
    const adapter = fakeAdapter({
      onNodeRightClick: vi.fn((handler) => {
        rightClickHandler = handler;
        return vi.fn();
      }),
      getNodeData: vi.fn(() => ({ label: "Invoicing", bpmoKind: "Domain" })),
      hasExpandedNeighbours: vi.fn(() => true),
    });

    const { result } = renderHook(() =>
      useNodeContextMenu({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        panel: LOADED_PANEL,
      }),
    );

    act(() => rightClickHandler?.("n1", { x: 12, y: 34 }));

    expect(result.current.menu).toEqual({
      nodeId: "n1",
      position: { x: 12, y: 34 },
      canFocusDomain: true,
      isExpanded: true,
    });
  });

  // Right-click on a node that isn't the currently spotlighted one has no
  // fetched neighbours to expand/collapse and isn't known to be a domain --
  // per AC-3's "already spotlighted" framing, no menu opens.
  it("does not open the menu for a node that is not the currently spotlighted one", () => {
    let rightClickHandler:
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;
    const adapter = fakeAdapter({
      onNodeRightClick: vi.fn((handler) => {
        rightClickHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useNodeContextMenu({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        panel: CLOSED_PANEL,
      }),
    );

    act(() => rightClickHandler?.("n2", { x: 12, y: 34 }));

    expect(result.current.menu).toBeNull();
  });

  it("closeMenu clears the open menu", () => {
    let rightClickHandler:
      | ((nodeId: string, position: { x: number; y: number }) => void)
      | undefined;
    const adapter = fakeAdapter({
      onNodeRightClick: vi.fn((handler) => {
        rightClickHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useNodeContextMenu({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        panel: LOADED_PANEL,
      }),
    );

    act(() => rightClickHandler?.("n1", { x: 12, y: 34 }));
    expect(result.current.menu).not.toBeNull();

    act(() => result.current.closeMenu());
    expect(result.current.menu).toBeNull();
  });
});
