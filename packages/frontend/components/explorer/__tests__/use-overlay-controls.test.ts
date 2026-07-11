import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG, type ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";

import { useOverlayControls } from "../use-overlay-controls";

// Same shape as use-filter-panel.test.ts's fakeAdapter -- the full
// RendererAdapter interface, every method a vi.fn() so a test only wires
// the return value it needs.
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

// A dimension with a real value->colour vocab, so the AC-1/AC-6 legend
// assertions have a non-empty entries list to check -- DEFAULT_EXPLORER_
// CONFIG's own heatmapMappings ship with empty `values` (task #28: the
// dimensions are known structure, the vocab isn't, pending prototype-
// findings.md).
const configWithMaturityValues: ExplorerConfig = {
  ...DEFAULT_EXPLORER_CONFIG,
  heatmapMappings: {
    ...DEFAULT_EXPLORER_CONFIG.heatmapMappings,
    maturity: { path: "maturity", values: { high: "var(--color-heat-5)" } },
  },
};

describe("useOverlayControls", () => {
  it("lists one toggle per FR-015 heatmap dimension plus domain colouring, all inactive initially", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() => useOverlayControls({ adapter, config: DEFAULT_EXPLORER_CONFIG }));

    expect(result.current.toggles.map((toggle) => toggle.id)).toEqual([
      "heatmap:maturity",
      "heatmap:investment",
      "heatmap:strategy",
      "heatmap:lifecycle",
      "domain-colouring",
    ]);
    expect(result.current.toggles.every((toggle) => !toggle.active && !toggle.disabled)).toBe(true);
    expect(result.current.legend).toBeNull();
  });

  it("activates a heatmap overlay, colours through the adapter, and exposes its legend (AC-1)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => nodeWithMaturity) });
    const { result } = renderHook(() => useOverlayControls({ adapter, config: configWithMaturityValues }));

    act(() => result.current.toggleOverlay("heatmap:maturity"));

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({ n1: "var(--color-heat-5)" }, DEFAULT_EXPLORER_CONFIG.heatNoneColour);
    expect(result.current.toggles.find((toggle) => toggle.id === "heatmap:maturity")?.active).toBe(true);
    expect(result.current.legend?.title).toBe("Heatmap — maturity");
  });

  it("activating a second colour overlay deactivates the first and disables its own toggle (AC-2)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => nodeWithMaturity) });
    const { result } = renderHook(() => useOverlayControls({ adapter, config: configWithMaturityValues }));

    act(() => result.current.toggleOverlay("heatmap:maturity"));
    act(() => result.current.toggleOverlay("domain-colouring"));

    expect(adapter.clearNodeColours).toHaveBeenCalledTimes(1); // heatmap's remove()
    const heatmapToggle = result.current.toggles.find((toggle) => toggle.id === "heatmap:maturity");
    expect(heatmapToggle?.active).toBe(false);
    expect(heatmapToggle?.disabled).toBe(true);
    expect(result.current.toggles.find((toggle) => toggle.id === "domain-colouring")?.active).toBe(true);
  });

  it("re-clicking the active overlay deactivates it and re-enables every toggle (AC-4)", () => {
    const adapter = fakeAdapter({ listElements: vi.fn(() => nodeWithMaturity) });
    const { result } = renderHook(() => useOverlayControls({ adapter, config: configWithMaturityValues }));

    act(() => result.current.toggleOverlay("heatmap:maturity"));
    act(() => result.current.toggleOverlay("heatmap:maturity"));

    expect(adapter.clearNodeColours).toHaveBeenCalledTimes(1);
    expect(result.current.toggles.every((toggle) => !toggle.active && !toggle.disabled)).toBe(true);
    expect(result.current.legend).toBeNull();
  });

  it("is a no-op when the adapter isn't ready yet", () => {
    const { result } = renderHook(() => useOverlayControls({ adapter: null, config: DEFAULT_EXPLORER_CONFIG }));

    act(() => result.current.toggleOverlay("domain-colouring"));

    expect(result.current.toggles.every((toggle) => !toggle.active)).toBe(true);
  });
});
