import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UseCompletenessOverlayResult } from "../use-completeness-overlay";
import { useCanvasOverlayToggles } from "../use-canvas-overlay-toggles";
import type { UseVersionsPanelResult } from "../use-versions-panel";

function fakeCompleteness(overrides: Partial<UseCompletenessOverlayResult> = {}): UseCompletenessOverlayResult {
  return {
    active: false,
    error: false,
    notice: null,
    gapIndex: {},
    toggle: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeVersionsPanel(overrides: Partial<UseVersionsPanelResult> = {}): UseVersionsPanelResult {
  return {
    versions: [],
    listError: false,
    readOnly: false,
    pinnedIri: null,
    loadError: null,
    compareFrom: null,
    compareTo: null,
    diffNote: null,
    diffError: false,
    selectVersion: vi.fn(),
    selectForCompare: vi.fn(),
    clearCompare: vi.fn(),
    exportDiff: vi.fn(),
    returnToDraft: vi.fn(),
    ...overrides,
  };
}

const V13 = { version_iri: "v13", semver: "1.3.0", published_at: "2026-07-01T00:00:00Z", is_latest: false };
const V14 = { version_iri: "v14", semver: "1.4.0", published_at: "2026-07-10T00:00:00Z", is_latest: true };

describe("useCanvasOverlayToggles", () => {
  it("proxies the completeness toggle through to completenessOverlay.toggle (AC-1)", () => {
    const completenessOverlay = fakeCompleteness();
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay, versionsPanel: fakeVersionsPanel() })
    );

    act(() => result.current.onToggleOverlay("completeness"));

    expect(completenessOverlay.toggle).toHaveBeenCalled();
  });

  // refit deferred item 1: default keeps the existing always-on dim (AC-1
  // of the node-spotlight hook is unaffected); flipping the toggle is the
  // only way impactEnabled changes.
  it("defaults impactEnabled to true and flips it on toggle", () => {
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay: fakeCompleteness(), versionsPanel: fakeVersionsPanel() })
    );

    expect(result.current.impactEnabled).toBe(true);
    expect(result.current.toggles.find((t) => t.id === "impact")).toMatchObject({ active: true, disabled: false });

    act(() => result.current.onToggleOverlay("impact"));

    expect(result.current.impactEnabled).toBe(false);
    expect(result.current.toggles.find((t) => t.id === "impact")).toMatchObject({ active: false });
  });

  it("disables the version-diff toggle with fewer than two published versions", () => {
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay: fakeCompleteness(), versionsPanel: fakeVersionsPanel({ versions: [V14] }) })
    );

    expect(result.current.toggles.find((t) => t.id === "version-diff")).toMatchObject({ disabled: true, active: false });
  });

  // "Version diff v13 -> v14" per the mock -- derived from the latest two
  // published versions (sorted by published_at), never a hardcoded pair.
  it("compares the latest two versions (by published_at) when the version-diff toggle is switched on", () => {
    const versionsPanel = fakeVersionsPanel({ versions: [V14, V13] });
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay: fakeCompleteness(), versionsPanel })
    );

    expect(result.current.toggles.find((t) => t.id === "version-diff")).toMatchObject({
      label: "Version diff: 1.3.0 → 1.4.0",
      disabled: false,
    });

    act(() => result.current.onToggleOverlay("version-diff"));

    expect(versionsPanel.selectForCompare).toHaveBeenNthCalledWith(1, "v13");
    expect(versionsPanel.selectForCompare).toHaveBeenNthCalledWith(2, "v14");
  });

  it("clears the compare when the version-diff toggle is switched off", () => {
    const versionsPanel = fakeVersionsPanel({ versions: [V13, V14], compareFrom: "v13", compareTo: "v14" });
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay: fakeCompleteness(), versionsPanel })
    );

    expect(result.current.toggles.find((t) => t.id === "version-diff")).toMatchObject({ active: true });

    act(() => result.current.onToggleOverlay("version-diff"));

    expect(versionsPanel.clearCompare).toHaveBeenCalled();
    expect(versionsPanel.selectForCompare).not.toHaveBeenCalled();
  });

  // Change heatmap has no backing data source yet (gap G17) -- always a
  // disabled, reasoned, inert toggle rather than fake data.
  it("renders the change-heatmap toggle as permanently disabled with a gap reason", () => {
    const { result } = renderHook(() =>
      useCanvasOverlayToggles({ completenessOverlay: fakeCompleteness(), versionsPanel: fakeVersionsPanel() })
    );

    const toggle = result.current.toggles.find((t) => t.id === "change-heatmap");
    expect(toggle).toMatchObject({ active: false, disabled: true });
    expect(toggle?.disabledReason).toMatch(/G17/);

    act(() => result.current.onToggleOverlay("change-heatmap"));

    expect(result.current.toggles.find((t) => t.id === "change-heatmap")).toMatchObject({ disabled: true });
  });
});
