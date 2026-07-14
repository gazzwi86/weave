import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { usePinnedImpact } from "../use-pinned-impact";

// Same shape as use-overlay-controls.test.ts's fakeAdapter.
function fakeAdapter(overrides: Partial<RendererAdapter> = {}): RendererAdapter {
  return {
    listNodes: vi.fn(() => [{ id: "urn:Process1", label: "Process1", bpmoKind: "Process" }]),
    listElements: vi.fn(() => []),
    setTraceHighlight: vi.fn(),
    clearTraceHighlight: vi.fn(),
    setDiffOverlay: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setViewport: vi.fn(),
    allNodePositions: vi.fn(() => ({})),
    applyPositions: vi.fn(),
    mergeInPlace: vi.fn(),    setBadges: vi.fn(),
    clearBadges: vi.fn(),    isHidden: vi.fn(() => false),
    onElementRemoved: vi.fn(() => vi.fn()),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
    ...overrides,
  } as unknown as RendererAdapter;
}

describe("usePinnedImpact (TASK-028 AC-3 real-canvas test seam)", () => {
  it("wires a dev-only window hook that pins a traceResult onto the real adapter", () => {
    const adapter = fakeAdapter();
    renderHook(() => usePinnedImpact({ adapter }));

    expect(window.__explorerPinImpactTrace).toBeInstanceOf(Function);
    window.__explorerPinImpactTrace?.("urn:Policy1", ["urn:Process1"]);

    expect(adapter.setTraceHighlight).toHaveBeenCalledWith(["urn:Process1"]);
  });

  it("wires a dev-only window hook that unpins by source iri", () => {
    const adapter = fakeAdapter();
    renderHook(() => usePinnedImpact({ adapter }));

    window.__explorerPinImpactTrace?.("urn:Policy1", ["urn:Process1"]);
    window.__explorerUnpinImpactTrace?.("urn:Policy1");

    expect(adapter.clearTraceHighlight).toHaveBeenCalled();
  });

  it("is a no-op when the canvas adapter isn't ready yet", () => {
    renderHook(() => usePinnedImpact({ adapter: null }));
    expect(() => window.__explorerPinImpactTrace?.("urn:Policy1", ["urn:Process1"])).not.toThrow();
  });
});
