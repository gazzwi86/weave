import { describe, expect, it } from "vitest";

import { computeFilterVisibility } from "../compute-filter-visibility";
import { createFilterState } from "../filter-state";
import type { CytoscapeElement } from "../types";

// TASK-020 AC-1/AC-2/AC-3/AC-4/AC-5: pure function turning a FilterState +
// the already-loaded canvas elements into the {hiddenNodeIds, dimmedNodeIds,
// hiddenEdgeIds} shape applyFilterVisibility expects. No adapter access, no
// network call -- everything reads the elements array it's given.
describe("computeFilterVisibility", () => {
  function node(id: string, bpmoKind?: string, keyProperties?: Record<string, string>): CytoscapeElement {
    return { data: { id, bpmo_kind: bpmoKind, key_properties: keyProperties } };
  }

  function edge(id: string, source: string, target: string, predicate: string): CytoscapeElement {
    return { data: { id, source, target, label: predicate } };
  }

  it("hides nodes whose kind is toggled off (AC-1)", () => {
    const elements = [node("a", "Policy"), node("b", "Concept")];
    const state = { ...createFilterState(), entityTypesOff: ["Policy"] };

    const result = computeFilterVisibility(elements, state);

    expect(result.hiddenNodeIds).toEqual(["a"]);
    expect(result.isEmpty).toBe(false);
  });

  it("reports isEmpty when every node's kind is toggled off (AC-2)", () => {
    const elements = [node("a", "Policy"), node("b", "Policy")];
    const state = { ...createFilterState(), entityTypesOff: ["Policy"] };

    const result = computeFilterVisibility(elements, state);

    expect(result.isEmpty).toBe(true);
  });

  it("hides edges of a toggled-off relationship type and dims nodes left with no visible edge (AC-3)", () => {
    const elements = [
      node("a", "Policy"),
      node("b", "Concept"),
      node("c", "Concept"),
      edge("a|governs|b", "a", "b", "governs"),
      edge("b|relatesTo|c", "b", "c", "relatesTo"),
    ];
    const state = { ...createFilterState(), relTypesOff: ["governs"] };

    const result = computeFilterVisibility(elements, state);

    expect(result.hiddenEdgeIds).toEqual(["a|governs|b"]);
    // "a" only had the governs edge -- now orphaned, dimmed not removed.
    expect(result.dimmedNodeIds).toContain("a");
    // "b" still has relatesTo -- not orphaned.
    expect(result.dimmedNodeIds).not.toContain("b");
    expect(result.hiddenNodeIds).not.toContain("a");
  });

  it("does not double-count edges already hidden by an entity-type-off endpoint (AC-1/AC-3 overlap)", () => {
    const elements = [node("a", "Policy"), node("b", "Concept"), edge("a|governs|b", "a", "b", "governs")];
    const state = { ...createFilterState(), entityTypesOff: ["Policy"], relTypesOff: ["governs"] };

    const result = computeFilterVisibility(elements, state);

    // the edge is already gone via a's node-hide -- not separately listed.
    expect(result.hiddenEdgeIds).toEqual([]);
  });

  it("dims non-matching nodes and leaves matching nodes undimmed for an AND-combined property filter (AC-4)", () => {
    const elements = [
      node("a", "Policy", { status: "active" }),
      node("b", "Policy", { status: "draft" }),
    ];
    const state = {
      ...createFilterState(),
      propertyFilters: [{ path: "status", op: "eq" as const, value: "active" }],
    };

    const result = computeFilterVisibility(elements, state);

    expect(result.dimmedNodeIds).toEqual(["b"]);
    expect(result.filterMatchEmpty).toBe(false);
  });

  it("treats a missing property path as non-matching on every node and reports filterMatchEmpty (AC-5)", () => {
    const elements = [node("a", "Policy", {}), node("b", "Policy")];
    const state = {
      ...createFilterState(),
      propertyFilters: [{ path: "no-such-path", op: "eq" as const, value: "x" }],
    };

    const result = computeFilterVisibility(elements, state);

    expect(result.dimmedNodeIds).toEqual(["a", "b"]);
    expect(result.filterMatchEmpty).toBe(true);
  });

  it("unions relationship-orphan dimming with property-filter dimming rather than overwriting it (AC-3+AC-4, single-batch AC-7)", () => {
    const elements = [
      node("a", "Policy", { status: "active" }),
      node("b", "Concept", { status: "active" }),
      edge("a|governs|b", "a", "b", "governs"),
    ];
    const state = {
      ...createFilterState(),
      relTypesOff: ["governs"],
      propertyFilters: [{ path: "status", op: "eq" as const, value: "inactive" }],
    };

    const result = computeFilterVisibility(elements, state);

    // "a" is orphaned by the rel toggle AND fails the property filter --
    // still just one dimmed entry, not lost either way.
    expect(result.dimmedNodeIds).toContain("a");
    expect(result.dimmedNodeIds).toContain("b");
  });
});
