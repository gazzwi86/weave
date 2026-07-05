import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { useSearchOverlay } from "../use-search-overlay";

function fakeAdapter(
  overrides: Partial<RendererAdapter> = {},
): RendererAdapter {
  return {
    load: vi.fn(),
    getViewport: vi.fn(() => ({ zoom: 1, pan: { x: 0, y: 0 } })),
    setLayout: vi.fn(),
    spotlightNode: vi.fn(() => true),
    resetOpacity: vi.fn(),
    highlightNodes: vi.fn(),
    onNodeTap: vi.fn(() => vi.fn()),
    onBackgroundTap: vi.fn(() => vi.fn()),
    getNodeData: vi.fn(),
    listNodes: vi.fn(() => [
      { id: "n1", label: "Customer Onboarding", bpmoKind: "Process" },
      { id: "n2", label: "Invoice", bpmoKind: "Process" },
    ]),
    centerOn: vi.fn(),
    onNodeDragEnd: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

describe("useSearchOverlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  // AC-5: Cmd+K (or the sidebar icon) opens the overlay, client-side only.
  it("opens on Cmd+K when no text input is focused", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        }),
      );
    });

    expect(result.current.open).toBe(true);
  });

  it("does not open on Cmd+K while a text input is focused (does not steal typing)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        }),
      );
    });

    expect(result.current.open).toBe(false);
  });

  // Cmd+K must not also trigger the app-wide command palette (same document,
  // same shortcut, different feature) -- see ADR-003.
  it("stops the Cmd+K keydown from bubbling to a page-wide listener", () => {
    const bubbleListener = vi.fn();
    document.body.addEventListener("keydown", bubbleListener);
    const adapter = fakeAdapter();
    renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        }),
      );
    });

    expect(bubbleListener).not.toHaveBeenCalled();
    document.body.removeEventListener("keydown", bubbleListener);
  });

  it("openOverlay()/closeOverlay() toggle manually (sidebar search icon path)", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => result.current.openOverlay());
    expect(result.current.open).toBe(true);

    act(() => result.current.closeOverlay());
    expect(result.current.open).toBe(false);
  });

  // AC-5: matching nodes highlight, non-matches dim.
  it("highlights matching nodes and lists them as results when the query matches", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => result.current.setQuery("onboard"));

    expect(result.current.results).toEqual([
      { id: "n1", label: "Customer Onboarding", typeLabel: "Process" },
    ]);
    expect(adapter.highlightNodes).toHaveBeenCalledWith(
      ["n1"],
      DEFAULT_EXPLORER_CONFIG.spotlightDimOpacity,
    );
    expect(result.current.noResults).toBe(false);
  });

  // AC-7: zero matches -> "No results" and canvas opacity untouched.
  it("reports noResults and leaves canvas opacity untouched when nothing matches", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => result.current.setQuery("nonexistent-thing"));

    expect(result.current.noResults).toBe(true);
    expect(result.current.results).toEqual([]);
    expect(adapter.highlightNodes).not.toHaveBeenCalled();
    expect(adapter.resetOpacity).not.toHaveBeenCalled();
  });

  it("resets opacity and clears results when the query is cleared", () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected: vi.fn(),
      }),
    );

    act(() => result.current.setQuery("onboard"));
    act(() => result.current.setQuery(""));

    expect(adapter.resetOpacity).toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.noResults).toBe(false);
  });

  // AC-6: selecting a result closes the overlay, centres + spotlights, and
  // notifies the caller (which drives the node-spotlight side panel).
  it("selectResult() closes the overlay, centres on the node, and notifies the caller", () => {
    const adapter = fakeAdapter();
    const onResultSelected = vi.fn();
    const { result } = renderHook(() =>
      useSearchOverlay({
        adapter,
        config: DEFAULT_EXPLORER_CONFIG,
        onResultSelected,
      }),
    );

    act(() => result.current.openOverlay());
    act(() => result.current.selectResult("n1"));

    expect(result.current.open).toBe(false);
    expect(adapter.centerOn).toHaveBeenCalledWith(
      "n1",
      DEFAULT_EXPLORER_CONFIG.centreAnimationMs,
    );
    expect(onResultSelected).toHaveBeenCalledWith("n1");
  });
});
