import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useVersionMode } from "../use-version-mode";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

function fakeAdapter(): RendererAdapter {
  return {
    load: vi.fn(),
    setLayout: vi.fn(),
    clearDiffOverlay: vi.fn(),
    setBadges: vi.fn(),
    clearBadges: vi.fn(),
  } as unknown as RendererAdapter;
}

describe("useVersionMode", () => {
  // AC-2: selecting a published version reloads the canvas read-only,
  // pinned to that version.
  it("loads a version-pinned graph and flips into read-only mode", async () => {
    const adapter = fakeAdapter();
    const fetchGraph = vi.fn().mockResolvedValue([{ data: { id: "n1", label: "N1" } }]);
    const { result } = renderHook(() => useVersionMode(adapter, fetchGraph));

    await act(async () => {
      await result.current.loadVersion("urn:workspace:demo:v1");
    });

    expect(fetchGraph).toHaveBeenCalledWith(expect.any(Number), "urn:workspace:demo:v1");
    expect(adapter.load).toHaveBeenCalledWith([{ data: { id: "n1", label: "N1" } }]);
    expect(result.current.mode).toBe("version");
    expect(result.current.readOnly).toBe(true);
    expect(result.current.pinnedIri).toBe("urn:workspace:demo:v1");
  });

  // AC-5: a fetch failure surfaces an error rather than leaving a blank canvas.
  it("surfaces an error and stays in draft mode when the load fails", async () => {
    const adapter = fakeAdapter();
    const fetchGraph = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useVersionMode(adapter, fetchGraph));

    await act(async () => {
      await result.current.loadVersion("urn:workspace:demo:v1");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.mode).toBe("draft");
  });

  // AC-8: return-to-draft reloads "latest" and clears read-only + any diff overlay.
  it("returns to the draft graph", async () => {
    const adapter = fakeAdapter();
    const fetchGraph = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useVersionMode(adapter, fetchGraph));

    await act(async () => {
      await result.current.loadVersion("urn:workspace:demo:v1");
    });
    await act(async () => {
      await result.current.returnToDraft();
    });

    expect(fetchGraph).toHaveBeenLastCalledWith(expect.any(Number), undefined);
    expect(adapter.clearDiffOverlay).toHaveBeenCalled();
    expect(result.current.mode).toBe("draft");
    expect(result.current.readOnly).toBe(false);
    expect(result.current.pinnedIri).toBeNull();
  });
});
