import { describe, expect, it } from "vitest";

import { createRendererAdapter, type CyCollection } from "../renderer-adapter";
import { OverlayEngine } from "../overlay-engine";
import { createDomainColouringOverlay } from "../overlays/domain-colouring-overlay";
import { createHeatmapOverlay, type HeatmapConfig } from "../overlays/heatmap-overlay";

import { fakeCollection, fakeCy } from "./renderer-adapter-test-support";

// TASK-021: the unit tests for OverlayEngine (overlay-engine.test.ts) and
// each overlay (overlays/__tests__/*) all drive against a mocked
// RendererAdapter -- none of them exercise the real createRendererAdapter
// implementation (cy.batch/cy.nodes().filter().style()) underneath. This
// file is the brief's required minimum-one integration test: OverlayEngine
// + createRendererAdapter(fakeCy) + a real overlay, round-tripped.

interface FakeNode {
  id: string;
  data: Record<string, unknown>;
}

/** A cy stub whose nodes/edges collections actually filter by id and
 * record applied colours per node -- unlike renderer-adapter-colour.test.ts's
 * mockReturnValueOnce chains (fine for that file's narrower unit scope),
 * this integration test needs the overlay's listElements()-driven mapping
 * logic and the colour-application seam to both operate on the same real
 * fixture data. */
function buildCyStub(nodes: FakeNode[], edges: FakeNode[]) {
  const appliedColours: Record<string, string> = {};

  function collection(items: FakeNode[]): CyCollection {
    return {
      ...fakeCollection(),
      length: items.length,
      id: () => items[0]?.id ?? "",
      data: (key: string) => items[0]?.data[key],
      map: (fn) => items.map((item) => fn(collection([item]))),
      filter: (pred) => collection(items.filter((item) => pred(collection([item])))),
      style: (styles: Record<string, unknown>) => {
        items.forEach((item) => {
          appliedColours[item.id] = (styles["background-color"] as string) ?? "";
        });
      },
    };
  }

  const cy = fakeCy();
  cy.nodes.mockReturnValue(collection(nodes));
  cy.edges.mockReturnValue(collection(edges));
  return { cy, appliedColours };
}

const HEATMAP_CONFIG: HeatmapConfig = {
  noneColour: "var(--color-heat-none)",
  heatmapMappings: {
    maturity: { path: "maturity", values: { active: "var(--color-heat-5)", emerging: "var(--color-heat-3)" } },
  },
};

function setHeatTokens() {
  document.documentElement.style.setProperty("--color-heat-5", "#e11");
  document.documentElement.style.setProperty("--color-heat-3", "#ee1");
  document.documentElement.style.setProperty("--color-heat-none", "#ccc");
}

describe("OverlayEngine + createRendererAdapter -- round trip", () => {
  it("activating a heatmap overlay colours real cytoscape nodes and exposes its legend (AC-1)", () => {
    setHeatTokens();
    const { cy, appliedColours } = buildCyStub(
      [
        { id: "n1", data: { key_properties: { maturity: "active" } } },
        { id: "n2", data: { key_properties: { maturity: "unmapped" } } },
      ],
      []
    );
    const adapter = createRendererAdapter(cy);
    const engine = new OverlayEngine();
    const overlay = createHeatmapOverlay("maturity", HEATMAP_CONFIG);

    engine.activate(overlay, adapter);

    expect(appliedColours).toEqual({ n1: "#e11", n2: "#ccc" });
    expect(engine.legendFor("heatmap:maturity")?.title).toBe("Heatmap — maturity");
  });

  it("activating domain colouring while a heatmap overlay is active deactivates the heatmap first (AC-2)", () => {
    setHeatTokens();
    document.documentElement.style.setProperty("--series-1", "#111");
    const nodes = [{ id: "n1", data: { key_properties: { maturity: "active" } } }, { id: "d1", data: {} }];
    const edges = [{ id: "e1", data: { source: "n1", target: "d1", label: "memberOf" } }];
    const adapter = createRendererAdapter(buildCyStub(nodes, edges).cy);
    const engine = new OverlayEngine();
    const heatmap = createHeatmapOverlay("maturity", HEATMAP_CONFIG);
    const domainConfig = { membershipPredicate: "memberOf", palette: ["var(--series-1)"], noneColour: "var(--color-heat-none)" };

    engine.activate(heatmap, adapter);
    engine.activate(createDomainColouringOverlay(domainConfig), adapter);

    expect(engine.isActive("heatmap:maturity")).toBe(false);
    expect(engine.activeInGroup("colour")).toBe("domain-colouring");
  });

  it("deactivating the active overlay restores base colouring on the real adapter (AC-4)", () => {
    setHeatTokens();
    const { cy, appliedColours } = buildCyStub([{ id: "n1", data: { key_properties: { maturity: "active" } } }], []);
    const adapter = createRendererAdapter(cy);
    const engine = new OverlayEngine();
    const overlay = createHeatmapOverlay("maturity", HEATMAP_CONFIG);

    engine.activate(overlay, adapter);
    engine.deactivate(overlay.id, adapter);

    expect(appliedColours).toEqual({ n1: "" });
    expect(engine.isActive("heatmap:maturity")).toBe(false);
  });
});
