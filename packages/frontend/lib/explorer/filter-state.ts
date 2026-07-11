import type { CytoscapeElementData } from "./types";

export type FilterOp = "eq" | "neq" | "contains" | "gt" | "lt";

export interface PropertyFilter {
  /** Optional kind scope (NodeKind.id / node.data.bpmo_kind token, e.g.
   * "process") -- a filter with a typeIri never matches a node of a
   * different kind. Unset = applies across all kinds. */
  typeIri?: string;
  path: string;
  op: FilterOp;
  value: string;
}

export type GovernedLayer = "glossary" | "brand" | "governance";

/** TASK-020: plain JSON-serialisable filter state -- TASK-026 stores this
 * verbatim in explorer_saved_views.definition, so arrays (not Set, which
 * JSON.stringify drops) are the wire shape even though the brief's
 * pseudocode sketches Sets. entityTypesOff/relTypesOff hold the same kind
 * token / predicate IRI values already used elsewhere (NodeKind.id,
 * node.data.bpmo_kind, edge.data.label) -- not a second identifier scheme. */
export interface FilterState {
  entityTypesOff: string[];
  relTypesOff: string[];
  propertyFilters: PropertyFilter[];
  layersOn: GovernedLayer[];
}

export function createFilterState(): FilterState {
  return { entityTypesOff: [], relTypesOff: [], propertyFilters: [], layersOn: [] };
}

function compareValues(actual: string, op: FilterOp, target: string): boolean {
  switch (op) {
    case "eq":
      return actual === target;
    case "neq":
      return actual !== target;
    case "contains":
      return actual.includes(target);
    case "gt":
      return Number(actual) > Number(target);
    case "lt":
      return Number(actual) < Number(target);
  }
}

/** AC-4/AC-5: client-side only -- reads whatever key_properties is already
 * on the loaded element (never fetches); a missing path, or a node with no
 * key_properties at all, is non-matching rather than an error. */
export function evalFilter(node: CytoscapeElementData, filter: PropertyFilter): boolean {
  if (filter.typeIri && node.bpmo_kind !== filter.typeIri) return false;
  const value = node.key_properties?.[filter.path];
  if (value === undefined) return false;
  return compareValues(value, filter.op, filter.value);
}

/** AC-4: property filters AND-combine -- every filter in the list must match. */
export function evalFilters(node: CytoscapeElementData, filters: PropertyFilter[]): boolean {
  return filters.every((filter) => evalFilter(node, filter));
}
