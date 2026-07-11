import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";
import type { WriteProxyFn } from "@/lib/explorer/edit-controller";

import { useQuickAdd } from "../use-quick-add";

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

describe("useQuickAdd", () => {
  // AC-3: double-click on empty canvas opens the name+kind popover.
  it("opens the popover at the double-click position when canEdit is true", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, kinds: KINDS })
    );

    act(() => dblClickHandler?.({ x: 100, y: 200 }));

    expect(result.current.popover).toEqual({ position: { x: 100, y: 200 } });
  });

  // AC-7: UX layer -- viewer role (or published canvas) never sees the popover.
  it("does not open the popover when canEdit is false", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: false, kinds: KINDS })
    );

    act(() => dblClickHandler?.({ x: 100, y: 200 }));

    expect(result.current.popover).toBeNull();
  });

  it("cancel clears the popover without calling the write proxy", () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });
    const writeProxy: WriteProxyFn = vi.fn();

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, kinds: KINDS, writeProxy })
    );
    act(() => dblClickHandler?.({ x: 100, y: 200 }));

    act(() => result.current.cancel());

    expect(result.current.popover).toBeNull();
    expect(writeProxy).not.toHaveBeenCalled();
  });

  // AC-3/AC-8: submit builds an add_node op with a local ref, commits via
  // the write proxy (reusing commitOp -- no second write path), and
  // reconciles the ghost to the real IRI on 201.
  it("submit commits an add_node op through the write proxy and reconciles on 201", async () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
      getViewport: vi.fn(() => ({ zoom: 2, pan: { x: 10, y: 20 } })),
    });
    const writeProxy: WriteProxyFn = vi.fn(async () => ({
      status: 201,
      body: { activity_iri: "a1", applied_count: 1, version_iri: "v1", ref_map: {} },
    }));

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, kinds: KINDS, writeProxy })
    );
    act(() => dblClickHandler?.({ x: 110, y: 220 }));

    await act(async () => {
      await result.current.submit("Invoicing", "Process");
    });

    expect(writeProxy).toHaveBeenCalledTimes(1);
    const [ops] = vi.mocked(writeProxy).mock.calls[0]!;
    expect(ops).toEqual([{ op: "add_node", ref: expect.any(String), kind: "Process", label: "Invoicing", properties: {} }]);
    expect(adapter.addLayerNodes).toHaveBeenCalledTimes(1);
    const [[addedElement]] = vi.mocked(adapter.addLayerNodes).mock.calls[0]!;
    expect(addedElement!.position).toEqual({ x: 50, y: 100 }); // (110-10)/2, (220-20)/2
    expect(result.current.popover).toBeNull(); // closed as soon as submit runs
  });

  it("submit surfaces humanised violation messages on 422", async () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });
    const writeProxy: WriteProxyFn = vi.fn(async () => ({
      status: 422,
      body: { violations: [{ focus_node: "n1", path: null, severity: "Violation", message: "Process requires performedBy" }] },
    }));

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, kinds: KINDS, writeProxy })
    );
    act(() => dblClickHandler?.({ x: 0, y: 0 }));

    await act(async () => {
      await result.current.submit("Invoicing", "Process");
    });

    expect(result.current.violationMessages).toEqual(["This item: Process requires performedBy"]);
  });

  it("submit offers a retry action on timeout", async () => {
    let dblClickHandler: ((position: { x: number; y: number }) => void) | undefined;
    const adapter = fakeAdapter({
      onBackgroundDoubleClick: vi.fn((handler) => {
        dblClickHandler = handler;
        return vi.fn();
      }),
    });
    const writeProxy: WriteProxyFn = vi
      .fn()
      .mockResolvedValueOnce({ status: 0, body: null })
      .mockResolvedValueOnce({ status: 201, body: { ref_map: {} } });

    const { result } = renderHook(() =>
      useQuickAdd({ adapter, config: DEFAULT_EXPLORER_CONFIG, canEdit: true, kinds: KINDS, writeProxy })
    );
    act(() => dblClickHandler?.({ x: 0, y: 0 }));

    await act(async () => {
      await result.current.submit("Invoicing", "Process");
    });

    expect(result.current.retry).not.toBeNull();

    await act(async () => {
      result.current.retry?.();
    });

    expect(writeProxy).toHaveBeenCalledTimes(2);
  });
});
