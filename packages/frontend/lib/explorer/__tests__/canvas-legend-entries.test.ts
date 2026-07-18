import { describe, expect, it } from "vitest";

import { nodeKindColorVar, overlayLegendToSections, paletteToLegendEntries } from "../canvas-legend-entries";
import type { NodeKind } from "../types";

describe("paletteToLegendEntries", () => {
  it("lowercases each palette id into the BpmoKind token CanvasLegend/KindChip expect", () => {
    const palette: NodeKind[] = [{ id: "Process", label: "Process", colour: "var(--color-kind-process)" }];
    expect(paletteToLegendEntries(palette)).toEqual([{ kind: "process", label: "Process" }]);
  });

  // CE-READ-1's kind catalogue can grow; KindChip's BpmoKind union is a
  // fixed 14-kind set, so an unrecognised id is dropped rather than passed
  // through to a component that would render it with no glyph/colour.
  it("drops a kind id that isn't one of KindChip's known BpmoKind values", () => {
    const palette: NodeKind[] = [
      { id: "Process", label: "Process", colour: "var(--color-kind-process)" },
      { id: "Widget", label: "Widget", colour: "var(--color-kind-fallback)" },
    ];
    expect(paletteToLegendEntries(palette)).toEqual([{ kind: "process", label: "Process" }]);
  });
});

describe("overlayLegendToSections", () => {
  it("returns no sections when there's no active overlay legend", () => {
    expect(overlayLegendToSections(null)).toEqual([]);
  });

  it("maps the active overlay's legend into one OverlayKey section, stripping the var() wrapper", () => {
    const sections = overlayLegendToSections({
      title: "Heatmap — maturity",
      entries: [{ label: "High", colour: "var(--color-success)" }],
      note: "2 nodes unmatched",
    });
    expect(sections).toEqual([
      {
        id: "overlay",
        label: "Heatmap — maturity",
        rows: [{ colorVar: "--color-success", label: "High" }],
      },
    ]);
  });
});

describe("nodeKindColorVar", () => {
  // CE-READ-1's bpmo_kind travels PascalCase ("Process"), same casing gap
  // paletteToLegendEntries bridges for the legend swatches -- the minimap
  // dot for a node must resolve to the same token as its kind's swatch.
  it("lowercases a known kind id into its --color-kind-* token", () => {
    expect(nodeKindColorVar("Process")).toBe("--color-kind-process");
  });

  it("falls back to the fallback token for a kind KindChip doesn't recognise", () => {
    expect(nodeKindColorVar("Widget")).toBe("--color-kind-fallback");
  });
});
