import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG, type ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";

import { useOverlayControls } from "../use-overlay-controls";

// Same fakeAdapter shape as use-overlay-controls.test.ts -- split into its
// own file (rather than growing that describe block) to stay under Law
// E's 50-line-per-function budget.
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
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

const nodeWithMaturity: CytoscapeElement[] = [
  { data: { id: "n1", label: "A", bpmo_kind: "Process", key_properties: { maturity: "High" } } },
];

const configWithMaturityValues: ExplorerConfig = {
  ...DEFAULT_EXPLORER_CONFIG,
  heatmapMappings: {
    ...DEFAULT_EXPLORER_CONFIG.heatmapMappings,
    maturity: { path: "maturity", values: { high: "var(--color-heat-5)" } },
  },
};

describe("useOverlayControls -- AC-5 perf trace", () => {
  // Mirrors use-filter-panel.ts's __explorerFilterApplyDurationMs --
  // Playwright-only wall-clock trace of the single engine.activate/
  // deactivate call a toggle triggers.
  it("records the toggle's wall-clock duration on window.__explorerOverlayApplyDurationMs", () => {
    delete window.__explorerOverlayApplyDurationMs;
    const adapter = fakeAdapter({ listElements: vi.fn(() => nodeWithMaturity) });
    const { result } = renderHook(() => useOverlayControls({ adapter, config: configWithMaturityValues }));

    act(() => result.current.toggleOverlay("heatmap:maturity"));

    expect(typeof window.__explorerOverlayApplyDurationMs).toBe("number");
  });
});
