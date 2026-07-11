import { describe, expect, it, vi } from "vitest";

import { createFilterState, evalFilter, evalFilters } from "../filter-state";
import type { FilterState } from "../filter-state";
import type { CytoscapeElementData } from "../types";

// AC-4/AC-5: property filters read only already-loaded element data
// (node.key_properties), AND-combine, and treat a missing path as
// non-matching -- never an error, never a network call.
describe("evalFilter", () => {
  const node: CytoscapeElementData = {
    id: "n1",
    label: "Onboarding",
    bpmo_kind: "process",
    key_properties: { status: "active", priority: "3" },
  };

  it("matches eq/neq/contains string operators against key_properties", () => {
    expect(evalFilter(node, { path: "status", op: "eq", value: "active" })).toBe(true);
    expect(evalFilter(node, { path: "status", op: "eq", value: "inactive" })).toBe(false);
    expect(evalFilter(node, { path: "status", op: "neq", value: "inactive" })).toBe(true);
    expect(evalFilter(node, { path: "status", op: "contains", value: "act" })).toBe(true);
  });

  it("matches gt/lt with numeric coercion", () => {
    expect(evalFilter(node, { path: "priority", op: "gt", value: "1" })).toBe(true);
    expect(evalFilter(node, { path: "priority", op: "lt", value: "1" })).toBe(false);
  });

  it("treats a property path missing on the node as non-matching (AC-5), never throws", () => {
    expect(evalFilter(node, { path: "no-such-path", op: "eq", value: "x" })).toBe(false);
  });

  it("treats a node with no key_properties at all as non-matching", () => {
    const bare: CytoscapeElementData = { id: "n2", label: "Bare" };
    expect(evalFilter(bare, { path: "status", op: "eq", value: "active" })).toBe(false);
  });

  it("scopes to typeIri when given -- a filter for another kind never matches", () => {
    expect(evalFilter(node, { typeIri: "policy", path: "status", op: "eq", value: "active" })).toBe(false);
    expect(evalFilter(node, { typeIri: "process", path: "status", op: "eq", value: "active" })).toBe(true);
  });

  it("never calls fetch -- client-side only, no CE query (AC-4)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    evalFilter(node, { path: "status", op: "eq", value: "active" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("evalFilters", () => {
  const node: CytoscapeElementData = {
    id: "n1",
    bpmo_kind: "process",
    key_properties: { status: "active", priority: "3" },
  };

  it("AND-combines every filter -- all must match", () => {
    expect(
      evalFilters(node, [
        { path: "status", op: "eq", value: "active" },
        { path: "priority", op: "gt", value: "1" },
      ])
    ).toBe(true);
  });

  it("fails the AND-combination when any single filter fails", () => {
    expect(
      evalFilters(node, [
        { path: "status", op: "eq", value: "active" },
        { path: "priority", op: "gt", value: "10" },
      ])
    ).toBe(false);
  });

  it("returns true for an empty filter list (no filters applied)", () => {
    expect(evalFilters(node, [])).toBe(true);
  });
});

// QA edge case (DoD: "FilterState is serialisable to JSON unchanged" --
// TASK-026 stores it verbatim in explorer_saved_views.definition, but no
// existing test asserted round-trip equality; only the type comment claimed
// it). Guards against a future field regressing to a Set/Map/function,
// which JSON.stringify would silently drop or corrupt.
describe("FilterState JSON round-trip (DoD serialisability requirement)", () => {
  it("round-trips an empty state unchanged through JSON.stringify/parse", () => {
    const state = createFilterState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("round-trips a populated state (all four fields) unchanged", () => {
    const state: FilterState = {
      entityTypesOff: ["Policy", "Concept"],
      relTypesOff: ["https://weave.example/governs"],
      propertyFilters: [{ typeIri: "process", path: "status", op: "eq", value: "active" }],
      layersOn: ["glossary", "governance"],
    };
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
