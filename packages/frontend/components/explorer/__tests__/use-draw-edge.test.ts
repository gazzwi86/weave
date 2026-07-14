import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { WriteProxyFn } from "@/lib/explorer/edit-controller";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { RelKind } from "@/lib/explorer/types";

import { useDrawEdge } from "../use-draw-edge";

const REL_TYPES: RelKind[] = [{ id: "performedBy", label: "performed by" }];

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

function wireDrawComplete(): {
  adapter: RendererAdapter;
  fire: (sourceId: string, targetId: string) => void;
} {
  let handler: ((sourceId: string, targetId: string) => void) | undefined;
  const adapter = fakeAdapter({
    onEdgeDrawComplete: vi.fn((h) => {
      handler = h;
      return vi.fn();
    }),
  });
  return { adapter, fire: (sourceId, targetId) => handler?.(sourceId, targetId) };
}

describe("useDrawEdge", () => {
  // AC-6: an edgehandles drag release opens the rel-type picker.
  it("opens the picker with source and target ids when canEdit is true", () => {
    const { adapter, fire } = wireDrawComplete();

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES })
    );
    act(() => fire("n1", "n2"));

    expect(result.current.picker).toEqual({ sourceId: "n1", targetId: "n2" });
  });

  // AC-7: UX layer -- viewer role (or published canvas) never sees the picker.
  it("does not open the picker when canEdit is false", () => {
    const { adapter, fire } = wireDrawComplete();

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: false, relTypes: REL_TYPES })
    );
    act(() => fire("n1", "n2"));

    expect(result.current.picker).toBeNull();
  });

  // AC-6: self-loops are blocked at drag time -- no picker, no network call.
  it("blocks a self-loop without opening the picker or calling the write proxy", () => {
    const { adapter, fire } = wireDrawComplete();
    const writeProxy: WriteProxyFn = vi.fn();

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES, writeProxy })
    );
    act(() => fire("n1", "n1"));

    expect(result.current.picker).toBeNull();
    expect(writeProxy).not.toHaveBeenCalled();
  });

  it("cancel clears the picker without calling the write proxy", () => {
    const { adapter, fire } = wireDrawComplete();
    const writeProxy: WriteProxyFn = vi.fn();

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES, writeProxy })
    );
    act(() => fire("n1", "n2"));

    act(() => result.current.cancel());

    expect(result.current.picker).toBeNull();
    expect(writeProxy).not.toHaveBeenCalled();
  });

  // AC-6/AC-8: submit builds an add_edge op (already-real subject/object
  // ids), commits via the write proxy (reusing commitOp), and the edge
  // reconciles as-is on 201 (no id rewrite -- edges already carry a final id).
  it("submit commits an add_edge op through the write proxy", async () => {
    const { adapter, fire } = wireDrawComplete();
    const writeProxy: WriteProxyFn = vi.fn(async () => ({
      status: 201,
      body: { activity_iri: "a1", applied_count: 1, version_iri: "v1", ref_map: {} },
    }));

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES, writeProxy })
    );
    act(() => fire("n1", "n2"));

    await act(async () => {
      await result.current.submit("performedBy");
    });

    expect(writeProxy).toHaveBeenCalledTimes(1);
    const [ops] = vi.mocked(writeProxy).mock.calls[0]!;
    expect(ops).toEqual([{ op: "add_edge", subject_ref: "n1", predicate: "performedBy", object_ref: "n2" }]);
    expect(adapter.addLayerNodes).toHaveBeenCalledTimes(1);
    const [[addedElement]] = vi.mocked(adapter.addLayerNodes).mock.calls[0]!;
    expect(addedElement).toEqual({ data: { id: "n1|performedBy|n2", source: "n1", target: "n2", label: "performedBy" } });
    expect(result.current.picker).toBeNull(); // closed as soon as submit runs
  });

  it("submit surfaces humanised violation messages on 422", async () => {
    const { adapter, fire } = wireDrawComplete();
    const writeProxy: WriteProxyFn = vi.fn(async () => ({
      status: 422,
      body: { violations: [{ focus_node: "n1", path: null, severity: "Violation", message: "cannot connect these kinds" }] },
    }));

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES, writeProxy })
    );
    act(() => fire("n1", "n2"));

    await act(async () => {
      await result.current.submit("performedBy");
    });

    expect(result.current.violationMessages).toEqual(["This item: cannot connect these kinds"]);
  });

  it("submit offers a retry action on timeout", async () => {
    const { adapter, fire } = wireDrawComplete();
    const writeProxy: WriteProxyFn = vi
      .fn()
      .mockResolvedValueOnce({ status: 0, body: null })
      .mockResolvedValueOnce({ status: 201, body: { ref_map: {} } });

    const { result } = renderHook(() =>
      useDrawEdge({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, relTypes: REL_TYPES, writeProxy })
    );
    act(() => fire("n1", "n2"));

    await act(async () => {
      await result.current.submit("performedBy");
    });

    expect(result.current.retry).not.toBeNull();

    await act(async () => {
      result.current.retry?.();
    });

    expect(writeProxy).toHaveBeenCalledTimes(2);
  });
});
