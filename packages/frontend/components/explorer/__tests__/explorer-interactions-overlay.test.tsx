import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";

import { ExplorerInteractions } from "../explorer-interactions";

// useCanvasLegend's default fetchPalette hits the real CE-READ-1 proxy --
// every test here passes its own fetchPalette, but the module import still
// needs a safe stub (mirrors explorer-interactions.test.tsx).
vi.mock("@/lib/explorer/fetch-graph", () => ({ fetchPalette: vi.fn(async () => []), fetchGraph: vi.fn(async () => []), fetchRelTypes: vi.fn(async () => []) }));
vi.mock("@/lib/explorer/versions/fetch-versions", () => ({ fetchVersions: vi.fn(async () => ({ type: "ok", versions: [] })) }));
vi.mock("@/lib/explorer/versions/fetch-diff", () => ({ fetchDiff: vi.fn(async () => ({ type: "ok", diff: { added: [], removed: [], modified: [] } })) }));
vi.mock("@/lib/explorer/fetch-ontology-types", () => ({ fetchOntologyTypes: vi.fn(async () => ({ type: "ok", relationships: [] })) }));
vi.mock("@/lib/explorer/comments-client", () => ({ listComments: vi.fn().mockResolvedValue([]), createComment: vi.fn() }));
vi.mock("@/lib/explorer/events-client", () => ({
  fetchEvents: vi.fn().mockResolvedValue({ status: 200, events: [], latest_seq: 0 }),
}));

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
    getNodeData: vi.fn(() => ({ label: "Finance", bpmoKind: "Domain" })),
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
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    onBackgroundDoubleClick: vi.fn(() => vi.fn()),
    onEdgeDrawComplete: vi.fn(() => vi.fn()),
    reconcileElement: vi.fn(),
    ...overrides,
  } as RendererAdapter;
}

// TASK-021 D-1: overlay controls mount alongside the existing
// filter/legend chrome, reusing the same shared shell (never a second
// floating panel) -- covers AC-1 (toggle colours the canvas) and
// AC-4 (turning it back off restores the base kind colours). Split into
// its own file rather than growing explorer-interactions.test.tsx past
// Law E's 300-line file budget.
describe("ExplorerInteractions -- TASK-021 overlay controls mount", () => {
  const fetchPalette = vi.fn(async () => [] as NodeKind[]);

  it("renders the overlay panel alongside the filter panel", () => {
    const adapter = fakeAdapter();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchPalette={fetchPalette} />);

    expect(screen.getByTestId("explorer-overlay-panel")).toBeInTheDocument();
  });

  it("activating a heatmap overlay colours the canvas and shows its legend in the shared shell (AC-1)", () => {
    const adapter = fakeAdapter();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchPalette={fetchPalette} />);

    fireEvent.click(screen.getByRole("switch", { name: "Heatmap: Maturity" }));

    expect(adapter.applyNodeColours).toHaveBeenCalled();
    expect(screen.getByText("Heatmap — maturity")).toBeInTheDocument();
  });

  it("turning the overlay back off restores base colours and drops its legend section (AC-4)", () => {
    const adapter = fakeAdapter();
    render(<ExplorerInteractions adapter={adapter} config={DEFAULT_EXPLORER_CONFIG} fetchPalette={fetchPalette} />);

    const toggle = screen.getByRole("switch", { name: "Heatmap: Maturity" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(adapter.clearNodeColours).toHaveBeenCalled();
    expect(screen.queryByText("Heatmap — maturity")).not.toBeInTheDocument();
  });
});
