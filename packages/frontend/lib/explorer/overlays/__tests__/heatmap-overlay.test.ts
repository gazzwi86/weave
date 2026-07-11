import { describe, expect, it, vi } from "vitest";

import type { RendererAdapter } from "../../renderer-adapter";
import type { CytoscapeElement } from "../../types";
import { createHeatmapOverlay, type HeatmapConfig } from "../heatmap-overlay";

function fakeAdapter(elements: CytoscapeElement[]): RendererAdapter {
  return {
    listElements: vi.fn(() => elements),
    applyNodeColours: vi.fn(),
    clearNodeColours: vi.fn(),
  } as unknown as RendererAdapter;
}

const CONFIG: HeatmapConfig = {
  noneColour: "var(--color-heat-none)",
  heatmapMappings: {
    maturity: {
      path: "maturity",
      values: { none: "var(--color-heat-1)", emerging: "var(--color-heat-3)", active: "var(--color-heat-5)" },
    },
  },
};

describe("createHeatmapOverlay", () => {
  // AC-1: colours nodes by the prototype value->colour mapping, unmatched
  // (or absent) values get the grey fallback token, counted for the legend.
  it("colours nodes per the prototype mapping and counts unmatched values as grey (AC-1)", () => {
    const adapter = fakeAdapter([
      { data: { id: "n1", key_properties: { maturity: "Active" } } },
      { data: { id: "n2", key_properties: { maturity: "  Emerging  " } } },
      { data: { id: "n3", key_properties: { maturity: "unknown-value" } } },
      { data: { id: "n4", key_properties: {} } },
      { data: { id: "n5" } },
      { data: { id: "e1", source: "n1", target: "n2" } }, // edge, must be skipped
    ]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith(
      { n1: "var(--color-heat-5)", n2: "var(--color-heat-3)" },
      "var(--color-heat-none)"
    );
    const legend = overlay.legend();
    expect(legend.note).toContain("unmatched: 3");
  });

  // normalise() = trim + lowercase, explicitly unit-tested per the brief's
  // implementation hints (free-text PRD field).
  it("normalises free-text values (trim + lowercase) before lookup", () => {
    const adapter = fakeAdapter([{ data: { id: "n1", key_properties: { maturity: "NONE" } } }]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({ n1: "var(--color-heat-1)" }, "var(--color-heat-none)");
  });

  // AC-6: dimension property present on zero loaded nodes -- every node
  // grey, distinct all-unmatched notice, no error, no blank canvas.
  it("shows every node grey with an all-unmatched notice when the dimension is absent everywhere (AC-6)", () => {
    const adapter = fakeAdapter([{ data: { id: "n1", key_properties: {} } }, { data: { id: "n2" } }]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);

    overlay.apply(adapter);

    expect(adapter.applyNodeColours).toHaveBeenCalledWith({}, "var(--color-heat-none)");
    const legend = overlay.legend();
    expect(legend.note).toContain("unmatched: 2");
    expect(legend.note?.toLowerCase()).toContain("no data");
  });

  it("handles zero loaded nodes without throwing (empty canvas)", () => {
    const adapter = fakeAdapter([]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);

    expect(() => overlay.apply(adapter)).not.toThrow();
    expect(adapter.applyNodeColours).toHaveBeenCalledWith({}, "var(--color-heat-none)");
  });

  it("restores prior colouring by clearing node colours on remove (AC-4)", () => {
    const adapter = fakeAdapter([]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);

    overlay.remove(adapter);

    expect(adapter.clearNodeColours).toHaveBeenCalledTimes(1);
  });

  it("is registered with the shared colour exclusiveGroup", () => {
    const overlay = createHeatmapOverlay("maturity", CONFIG);
    expect(overlay.exclusiveGroup).toBe("colour");
    expect(overlay.id).toBe("heatmap:maturity");
  });

  it("builds legend entries from the dimension's mapping, one per known value", () => {
    const adapter = fakeAdapter([]);
    const overlay = createHeatmapOverlay("maturity", CONFIG);
    overlay.apply(adapter);

    const legend = overlay.legend();
    expect(legend.entries).toEqual(
      expect.arrayContaining([
        { label: "none", colour: "var(--color-heat-1)" },
        { label: "emerging", colour: "var(--color-heat-3)" },
        { label: "active", colour: "var(--color-heat-5)" },
      ])
    );
  });
});
