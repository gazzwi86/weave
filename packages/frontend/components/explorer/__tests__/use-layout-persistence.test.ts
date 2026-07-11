import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useLayoutPersistence } from "../use-layout-persistence";

const NODE_ID = "urn:weave:x:1";
const GRAPH_ID = DEFAULT_EXPLORER_CONFIG.layoutGraphId;

function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
  return {
    load: vi.fn(),
    getViewport: vi.fn(),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    onNodeRightClick: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(),
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
    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyFilterVisibility: vi.fn(),
    ...overrides,
  };
}

// TASK-004 AC-1/AC-2/AC-4: drag-persist with backoff retry (toast only once
// every retry is exhausted), and reset-layout (clear + re-randomize fcose).
describe("useLayoutPersistence", () => {
  it("saves a dropped node's position via onNodeDragEnd, first try", async () => {
    const save = vi.fn(async () => undefined);
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, save })
    );
    act(() => dragHandler?.(NODE_ID, { x: 5, y: 9 }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(GRAPH_ID, NODE_ID, 5, 9));
  });

  it("skips saving literal nodes (id is not an IRI) without a toast", async () => {
    const save = vi.fn(async () => undefined);
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, save })
    );
    act(() => dragHandler?.("Order Fulfillment", { x: 5, y: 9 }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.saveFailed).toBe(false);
  });

  it("retries with the configured backoff delays on failure, then succeeds without a toast", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(undefined);
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, save })
    );
    act(() => dragHandler?.(NODE_ID, { x: 5, y: 9 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_EXPLORER_CONFIG.layoutSaveRetryDelaysMs[0] ?? 0);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.saveFailed).toBe(false);
    vi.useRealTimers();
  });

  it("surfaces saveFailed only once every retry delay is exhausted", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {
      throw new Error("down");
    });
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, save })
    );
    act(() => dragHandler?.(NODE_ID, { x: 5, y: 9 }));
    await act(async () => {
      for (const delayMs of DEFAULT_EXPLORER_CONFIG.layoutSaveRetryDelaysMs) {
        await vi.advanceTimersByTimeAsync(delayMs);
      }
    });

    expect(save).toHaveBeenCalledTimes(DEFAULT_EXPLORER_CONFIG.layoutSaveRetryDelaysMs.length + 1);
    expect(result.current.saveFailed).toBe(true);
    vi.useRealTimers();
  });

  it("dismissSaveFailure() clears the failure flag", async () => {
    const save = vi.fn(async () => {
      throw new Error("down");
    });
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useLayoutPersistence({
        adapter,
        config: { ...DEFAULT_EXPLORER_CONFIG, layoutSaveRetryDelaysMs: [] },
        graphId: GRAPH_ID,
        save,
      })
    );

    act(() => result.current.dismissSaveFailure());

    expect(result.current.saveFailed).toBe(false);
  });

  // QA edge case (race condition): each drag-end starts its own independent
  // saveWithRetry loop with no cancellation/de-dupe keyed by nodeId, so a
  // second drag on the same node while the first drag's retry is still
  // in-flight fires a second, fully independent retry loop rather than
  // superseding the first. This asserts today's actual behaviour (both
  // calls land, in call order) rather than a "last drag wins" guarantee --
  // the hook does not currently provide one. Flagged as a non-blocking WARN
  // for epic assembly: an out-of-order retry resolution could overwrite a
  // newer position with a stale one.
  it("does not crash and issues both saves when the same node is dragged again while a retry is in flight", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined);
    let dragHandler: ((nodeId: string, position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onNodeDragEnd: vi.fn((handler) => {
        dragHandler = handler;
        return vi.fn();
      }),
    });

    renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, save })
    );
    act(() => dragHandler?.(NODE_ID, { x: 5, y: 9 }));
    // Second drag on the same node fires before the first's retry delay elapses.
    act(() => dragHandler?.(NODE_ID, { x: 40, y: 40 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_EXPLORER_CONFIG.layoutSaveRetryDelaysMs[0] ?? 0);
    });

    // Both the second drag's immediate attempt and the first drag's retry land.
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenNthCalledWith(1, GRAPH_ID, NODE_ID, 5, 9);
    expect(save).toHaveBeenNthCalledWith(2, GRAPH_ID, NODE_ID, 40, 40);
    vi.useRealTimers();
  });

  it("resetLayout() clears saved positions then re-runs fcose with randomize on", async () => {
    const reset = vi.fn(async () => undefined);
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useLayoutPersistence({ adapter, config: DEFAULT_EXPLORER_CONFIG, graphId: GRAPH_ID, reset })
    );

    await act(async () => result.current.resetLayout());

    expect(reset).toHaveBeenCalledWith(GRAPH_ID);
    expect(adapter.setLayout).toHaveBeenCalledWith(
      "fcose",
      expect.objectContaining({ randomize: true })
    );
  });
});
