import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// fake timers control setInterval; `flush()` lets queued promise
// microtasks (the fetchEvents/fetchDelta mocks) settle in between.
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useEventPoll } from "../use-event-poll";

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
    clearNodeColours: vi.fn(),
    setTraceHighlight: vi.fn(),
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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// AC-7: "should merge poll delta preserving unsaved drag positions"
describe("useEventPoll -- merge", () => {
  it("merges a changed-element delta into the canvas, preserving unsaved drag ids", async () => {
    const adapter = fakeAdapter();
    const fetchEvents = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, events: [], latest_seq: 5 })
      .mockResolvedValueOnce({ status: 200, events: [{ entity_iri: "n1", version_iri: null, seq: 6 }], latest_seq: 6 });
    const delta = [{ data: { id: "n1", label: "Updated" } }];
    const fetchDelta = vi.fn().mockResolvedValue(delta);

    renderHook(() =>
      useEventPoll({
        adapter,
        active: true,
        intervalMs: 1000,
        fetchEvents,
        fetchDelta,
        reloadGraph: vi.fn(),
        unsavedDragIds: () => ["n2"],
      })
    );

    await flush();
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(adapter.mergeInPlace).toHaveBeenCalledWith(delta, ["n2"]);
  });
});

// AC-7: "should re-baseline via full reload when the events cursor returns 410"
describe("useEventPoll -- 410 re-baseline", () => {
  it("reloads the draft graph and re-fetches a fresh baseline cursor on 410, keyed off status not latest_seq", async () => {
    const adapter = fakeAdapter();
    const reloadGraph = vi.fn().mockResolvedValue(undefined);
    const fetchEvents = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, events: [], latest_seq: 5 })
      .mockResolvedValueOnce({ status: 410 })
      .mockResolvedValueOnce({ status: 200, events: [], latest_seq: 9 });

    renderHook(() =>
      useEventPoll({
        adapter,
        active: true,
        intervalMs: 1000,
        fetchEvents,
        fetchDelta: vi.fn(),
        reloadGraph,
        unsavedDragIds: () => [],
      })
    );

    await flush();
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(reloadGraph).toHaveBeenCalledTimes(1);
    expect(fetchEvents).toHaveBeenCalledTimes(3);
  });
});

// AC-7: "should pause poll when canvas mode is version or diff"
describe("useEventPoll -- pause", () => {
  it("never starts a timer (no fetchEvents call at all) while active is false", async () => {
    const fetchEvents = vi.fn();
    renderHook(() =>
      useEventPoll({
        adapter: fakeAdapter(),
        active: false,
        fetchEvents,
        fetchDelta: vi.fn(),
        reloadGraph: vi.fn(),
        unsavedDragIds: () => [],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchEvents).not.toHaveBeenCalled();
  });
});
