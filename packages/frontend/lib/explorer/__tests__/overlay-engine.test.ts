import { describe, expect, it, vi } from "vitest";

import { OverlayEngine, type Overlay, type OverlayLegendModel } from "../overlay-engine";
import type { RendererAdapter } from "../renderer-adapter";

// The engine never reaches into the adapter itself (only overlay.apply/
// remove do) -- a stub value stands in for it in every test here.
const fakeAdapter = {} as RendererAdapter;

function makeOverlay(id: string, exclusiveGroup?: string, legend: OverlayLegendModel = { title: id, entries: [] }): Overlay {
  return {
    id,
    exclusiveGroup,
    apply: vi.fn(),
    remove: vi.fn(),
    legend: vi.fn(() => legend),
  };
}

describe("OverlayEngine", () => {
  it("applies the overlay and marks it active on activate", () => {
    const engine = new OverlayEngine();
    const overlay = makeOverlay("heatmap:maturity");

    engine.activate(overlay, fakeAdapter);

    expect(overlay.apply).toHaveBeenCalledWith(fakeAdapter);
    expect(engine.isActive("heatmap:maturity")).toBe(true);
  });

  // AC-2: activating a second overlay in the same exclusiveGroup deactivates
  // (removes) every other overlay already active in that group.
  it("deactivates every other overlay in the same exclusiveGroup when one activates (AC-2)", () => {
    const engine = new OverlayEngine();
    const heatmap = makeOverlay("heatmap:maturity", "colour");
    const domainColouring = makeOverlay("domain-colouring", "colour");

    engine.activate(heatmap, fakeAdapter);
    engine.activate(domainColouring, fakeAdapter);

    expect(heatmap.remove).toHaveBeenCalledWith(fakeAdapter);
    expect(engine.isActive("heatmap:maturity")).toBe(false);
    expect(engine.isActive("domain-colouring")).toBe(true);
  });

  it("never deactivates an overlay in a different exclusiveGroup", () => {
    const engine = new OverlayEngine();
    const heatmap = makeOverlay("heatmap:maturity", "colour");
    const otherGroup = makeOverlay("some-badge-overlay", "badge");

    engine.activate(otherGroup, fakeAdapter);
    engine.activate(heatmap, fakeAdapter);

    expect(otherGroup.remove).not.toHaveBeenCalled();
    expect(engine.isActive("some-badge-overlay")).toBe(true);
  });

  it("never deactivates an overlay with no exclusiveGroup", () => {
    const engine = new OverlayEngine();
    const ungrouped = makeOverlay("pinned-impact");
    const heatmap = makeOverlay("heatmap:maturity", "colour");

    engine.activate(ungrouped, fakeAdapter);
    engine.activate(heatmap, fakeAdapter);

    expect(ungrouped.remove).not.toHaveBeenCalled();
  });

  // AC-4: deactivate calls the overlay's own remove() (which is where
  // "restore prior colouring" lives -- see heatmap/domain-colouring
  // overlay tests for the concrete adapter.clearNodeColours() assertion).
  it("calls remove() and clears active state on deactivate (AC-4)", () => {
    const engine = new OverlayEngine();
    const overlay = makeOverlay("heatmap:maturity");
    engine.activate(overlay, fakeAdapter);

    engine.deactivate("heatmap:maturity", fakeAdapter);

    expect(overlay.remove).toHaveBeenCalledWith(fakeAdapter);
    expect(engine.isActive("heatmap:maturity")).toBe(false);
  });

  it("is a no-op deactivating an id that isn't active", () => {
    const engine = new OverlayEngine();
    expect(() => engine.deactivate("nothing-active", fakeAdapter)).not.toThrow();
  });

  // Integration-shaped: re-enabling one exclusive overlay after another was
  // already the active one in that group -- both toggles round-trip cleanly.
  it("re-enabling an overlay disables the other exclusive overlay that activated it off (integration)", () => {
    const engine = new OverlayEngine();
    const heatmap = makeOverlay("heatmap:maturity", "colour");
    const domainColouring = makeOverlay("domain-colouring", "colour");

    engine.activate(heatmap, fakeAdapter);
    engine.activate(domainColouring, fakeAdapter);
    engine.activate(heatmap, fakeAdapter);

    expect(engine.isActive("heatmap:maturity")).toBe(true);
    expect(engine.isActive("domain-colouring")).toBe(false);
    expect(domainColouring.remove).toHaveBeenCalledTimes(1);
  });

  it("returns the active overlay's legend model via legendFor", () => {
    const engine = new OverlayEngine();
    const legend: OverlayLegendModel = { title: "Heatmap — maturity", entries: [{ colour: "var(--color-heat-1)", label: "None" }] };
    const overlay = makeOverlay("heatmap:maturity", "colour", legend);

    engine.activate(overlay, fakeAdapter);

    expect(engine.legendFor("heatmap:maturity")).toEqual(legend);
    expect(engine.legendFor("nothing-active")).toBeUndefined();
  });

  it("reports which overlay (if any) is active in a given exclusiveGroup", () => {
    const engine = new OverlayEngine();
    const heatmap = makeOverlay("heatmap:maturity", "colour");

    expect(engine.activeInGroup("colour")).toBeUndefined();
    engine.activate(heatmap, fakeAdapter);
    expect(engine.activeInGroup("colour")).toBe("heatmap:maturity");
  });
});
