import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSavedViews } from "../use-saved-views";

function fakeAdapter() {
  return {
    getViewport: vi.fn().mockReturnValue({ zoom: 2, pan: { x: 1, y: 1 } }),
    allNodePositions: vi.fn().mockReturnValue({ n1: { x: 5, y: 5 } }),
    applyPositions: vi.fn(),
    setViewport: vi.fn(),
  };
}

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    adapter: fakeAdapter(),
    filterState: { entityTypesOff: [], relTypesOff: [], propertyFilters: [], layersOn: [] },
    activeOverlayIds: ["overlay-a"],
    domainFocus: null,
    setFilterState: vi.fn(),
    setActiveOverlayIds: vi.fn(),
    setDomainFocus: vi.fn(),
    reloadGraph: vi.fn().mockResolvedValue(undefined),
    loadedNodeIds: vi.fn().mockReturnValue(new Set(["n1"])),
    saveView: vi.fn(),
    listViews: vi.fn().mockResolvedValue([]),
    deleteView: vi.fn(),
    shareView: vi.fn(),
    fetchLayoutPositions: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const OPEN_VIEW_FIXTURE = {
  view_id: "v1",
  name: "n",
  created_by: "u",
  pinned: false,
  updated_at: "t",
  definition: {
    filterState: { entityTypesOff: ["process"], relTypesOff: [], propertyFilters: [], layersOn: [] },
    activeOverlayIds: ["overlay-b"],
    domainFocus: "iri:domain-1",
    viewport: { zoom: 3, pan: { x: 9, y: 9 } },
  },
};

describe("useSavedViews save()", () => {
  // AC-1
  it("save() serialises current canvas state and refreshes the library on success", async () => {
    const saveView = vi.fn().mockResolvedValue({ status: "created", view_id: "v1" });
    const listViews = vi.fn().mockResolvedValue([{ view_id: "v1", name: "n", created_by: "u", pinned: false, updated_at: "t", definition: {} }]);
    const { result } = renderHook(() => useSavedViews(baseOptions({ saveView, listViews }) as never));

    let saveResult;
    await act(async () => {
      saveResult = await result.current.save("my view");
    });

    expect(saveView).toHaveBeenCalledWith(
      expect.objectContaining({ name: "my view", positions: [{ node_iri: "n1", position_x: 5, position_y: 5 }] })
    );
    expect(saveResult).toEqual({ status: "created", view_id: "v1" });
    expect(result.current.views).toHaveLength(1);
  });

  // AC-1: 409 collision does not refresh the library (caller re-prompts).
  it("save() does not refresh the library on a name collision", async () => {
    const saveView = vi.fn().mockResolvedValue({ status: "collision", existing_view_id: "v9" });
    const listViews = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useSavedViews(baseOptions({ saveView, listViews }) as never));

    await act(async () => {
      await result.current.save("dup");
    });

    expect(listViews).not.toHaveBeenCalled();
  });
});

describe("useSavedViews open()", () => {
  function setupOpenTest() {
    const adapter = fakeAdapter();
    const reloadGraph = vi.fn().mockResolvedValue(undefined);
    const setFilterState = vi.fn();
    const setActiveOverlayIds = vi.fn();
    const setDomainFocus = vi.fn();
    const fetchLayoutPositions = vi.fn().mockResolvedValue([
      { node_iri: "n1", position_x: 1, position_y: 2, locked: false },
      { node_iri: "gone", position_x: 3, position_y: 4, locked: false },
    ]);
    const loadedNodeIds = vi.fn().mockReturnValue(new Set(["n1"]));
    const options = baseOptions({
      adapter,
      reloadGraph,
      setFilterState,
      setActiveOverlayIds,
      setDomainFocus,
      fetchLayoutPositions,
      loadedNodeIds,
    });
    return { adapter, reloadGraph, setFilterState, setActiveOverlayIds, setDomainFocus, options };
  }

  // AC-2/AC-3: open() reproduces state in pseudocode order and flags missing entities.
  it("open() reloads, applies positions/filters/overlays/viewport, and reports missing entities", async () => {
    const { adapter, reloadGraph, setFilterState, setActiveOverlayIds, setDomainFocus, options } = setupOpenTest();
    const view = OPEN_VIEW_FIXTURE;
    const { result } = renderHook(() => useSavedViews(options as never));

    let openResult;
    await act(async () => {
      openResult = await result.current.open(view as never);
    });

    expect(reloadGraph).toHaveBeenCalled();
    expect(adapter.applyPositions).toHaveBeenCalledWith({ n1: { x: 1, y: 2 }, gone: { x: 3, y: 4 } });
    expect(setFilterState).toHaveBeenCalledWith(view.definition.filterState);
    expect(setActiveOverlayIds).toHaveBeenCalledWith(view.definition.activeOverlayIds);
    expect(setDomainFocus).toHaveBeenCalledWith(view.definition.domainFocus);
    expect(adapter.setViewport).toHaveBeenCalledWith(view.definition.viewport);
    // "domain-1" (from domainFocus) and "gone" (from positions) are both absent from loadedNodeIds.
    expect(openResult).toEqual({ missingCount: 2 });
  });
});

describe("useSavedViews remove()/share()", () => {
  // AC-4
  it("remove() refreshes the library only when the delete succeeds", async () => {
    const deleteView = vi.fn().mockResolvedValue(true);
    const listViews = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useSavedViews(baseOptions({ deleteView, listViews }) as never));

    await act(async () => {
      await result.current.remove("v1");
    });

    expect(listViews).toHaveBeenCalledTimes(1);
  });

  // AC-5
  it("share() forwards to the client and returns its result untouched", async () => {
    const shareView = vi.fn().mockResolvedValue({ notified: 2, excluded: 1 });
    const { result } = renderHook(() => useSavedViews(baseOptions({ shareView }) as never));

    let shareResult;
    await act(async () => {
      shareResult = await result.current.share("v1", ["a@x.com"]);
    });

    expect(shareView).toHaveBeenCalledWith("v1", ["a@x.com"]);
    expect(shareResult).toEqual({ notified: 2, excluded: 1 });
  });
});
