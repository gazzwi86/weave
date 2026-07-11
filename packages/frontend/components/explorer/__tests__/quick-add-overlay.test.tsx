import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";

import { QuickAddOverlay } from "../quick-add-overlay";

const KINDS: NodeKind[] = [{ id: "Process", label: "Process", colour: "var(--color-kind-process)" }];

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
    expandNode: vi.fn(() => []),
    collapseNode: vi.fn(),
    hasExpandedNeighbours: vi.fn(() => false),
    addLayerNodes: vi.fn(() => []),
    removeElements: vi.fn(),
    reconcileElement: vi.fn(),
    listElements: vi.fn(() => []),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

describe("QuickAddOverlay", () => {
  // AC-3: a double-click on empty canvas opens the popover when the caller
  // permits editing (canEdit computed from role + canvas-mode upstream).
  it("opens the popover on a background double-click when canEdit is true", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });

    render(<QuickAddOverlay adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} canEdit={true} kinds={KINDS} />);
    act(() => dblClickHandler?.({ x: 10, y: 20 }));

    expect(screen.getByRole("dialog", { name: /add node/i })).toBeInTheDocument();
  });

  // AC-7: UX layer -- viewer role never sees the popover.
  it("never opens the popover when canEdit is false", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });

    render(<QuickAddOverlay adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} canEdit={false} kinds={KINDS} />);
    act(() => dblClickHandler?.({ x: 10, y: 20 }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelling the popover closes it without touching the write proxy", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });

    render(<QuickAddOverlay adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} canEdit={true} kinds={KINDS} />);
    act(() => dblClickHandler?.({ x: 10, y: 20 }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
