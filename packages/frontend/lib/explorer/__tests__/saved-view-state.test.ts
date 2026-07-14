import { describe, expect, it } from "vitest";

import { createFilterState } from "../filter-state";
import { buildSaveViewBody, computeMissingEntityIds, type SavedViewDefinition } from "../saved-view-state";

function definition(overrides: Partial<SavedViewDefinition> = {}): SavedViewDefinition {
  return {
    filterState: createFilterState(),
    activeOverlayIds: [],
    domainFocus: null,
    viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    ...overrides,
  };
}

// AC-1: "should serialise full canvas state into save body"
describe("buildSaveViewBody", () => {
  it("serialises filterState/overlays/domainFocus/viewport verbatim and converts positions to API rows", () => {
    const filterState = { ...createFilterState(), entityTypesOff: ["process"] };
    const body = buildSaveViewBody({
      name: "My view",
      definition: definition({ filterState, activeOverlayIds: ["heatmap"], domainFocus: "iri:domain-1" }),
      positions: { "iri:n1": { x: 10, y: 20 } },
    });

    expect(body).toEqual({
      name: "My view",
      overwrite: false,
      definition: {
        filterState,
        activeOverlayIds: ["heatmap"],
        domainFocus: "iri:domain-1",
        viewport: { zoom: 1, pan: { x: 0, y: 0 } },
      },
      positions: [{ node_iri: "iri:n1", position_x: 10, position_y: 20 }],
    });
  });

  it("defaults overwrite to false and passes overwrite=true through when set", () => {
    const body = buildSaveViewBody({ name: "n", definition: definition(), positions: {}, overwrite: true });
    expect(body.overwrite).toBe(true);
  });
});

// AC-3: "should compute missing-entity set on view open"
describe("computeMissingEntityIds", () => {
  it("flags position and domain-focus IRIs absent from the loaded graph", () => {
    const missing = computeMissingEntityIds(
      definition({ domainFocus: "iri:gone-domain" }),
      ["iri:n1", "iri:gone-node"],
      new Set(["iri:n1"])
    );

    expect(missing.sort()).toEqual(["iri:gone-domain", "iri:gone-node"]);
  });

  it("returns an empty list when every referenced entity is still loaded", () => {
    const missing = computeMissingEntityIds(definition({ domainFocus: "iri:d1" }), ["iri:n1"], new Set(["iri:n1", "iri:d1"]));
    expect(missing).toEqual([]);
  });
});
