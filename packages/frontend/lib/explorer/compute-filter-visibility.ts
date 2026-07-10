import { evalFilters } from "./filter-state";
import type { FilterState } from "./filter-state";
import type { CytoscapeElement } from "./types";

export interface FilterVisibilityResult {
  hiddenNodeIds: string[];
  dimmedNodeIds: string[];
  hiddenEdgeIds: string[];
  /** AC-2: every loaded node's kind is toggled off. */
  isEmpty: boolean;
  /** AC-5: property filters are active but no visible node matches. */
  filterMatchEmpty: boolean;
}

function isEdge(el: CytoscapeElement): boolean {
  return el.data.source !== undefined && el.data.target !== undefined;
}

// AC-1: nodes whose kind is toggled off.
function computeHiddenNodeIds(nodes: CytoscapeElement[], entityTypesOff: string[]): Set<string> {
  const off = new Set(entityTypesOff);
  return new Set(nodes.filter((n) => n.data.bpmo_kind && off.has(n.data.bpmo_kind)).map((n) => n.data.id));
}

// AC-3: edges of a toggled-off relationship type, restricted to edges
// between two still-visible nodes -- an edge touching an already
// entity-hidden node is already covered by the adapter's incident-edge hide,
// so it's deliberately excluded here to avoid double-listing it.
function computeHiddenEdgeIds(edges: CytoscapeElement[], hiddenNodeIds: Set<string>, relTypesOff: string[]): Set<string> {
  const off = new Set(relTypesOff);
  return new Set(
    edges
      .filter((e) => !hiddenNodeIds.has(e.data.source!) && !hiddenNodeIds.has(e.data.target!))
      .filter((e) => e.data.label && off.has(e.data.label))
      .map((e) => e.data.id),
  );
}

// AC-3: a visible node is orphaned when it had at least one edge to another
// visible node and every such edge just got hidden by the relationship
// toggle -- dimmed, not removed.
function computeOrphanedNodeIds(edges: CytoscapeElement[], hiddenNodeIds: Set<string>, hiddenEdgeIds: Set<string>): Set<string> {
  const visibleEdges = edges.filter((e) => !hiddenNodeIds.has(e.data.source!) && !hiddenNodeIds.has(e.data.target!));
  const incident = new Map<string, number>();
  const remaining = new Map<string, number>();
  for (const edge of visibleEdges) {
    for (const endpoint of [edge.data.source!, edge.data.target!]) {
      incident.set(endpoint, (incident.get(endpoint) ?? 0) + 1);
      if (!hiddenEdgeIds.has(edge.data.id)) remaining.set(endpoint, (remaining.get(endpoint) ?? 0) + 1);
    }
  }
  const orphaned = new Set<string>();
  for (const [nodeId, count] of incident) {
    if (count > 0 && (remaining.get(nodeId) ?? 0) === 0) orphaned.add(nodeId);
  }
  return orphaned;
}

/** TASK-020: turns a FilterState + the already-loaded canvas elements into
 * the {hiddenNodeIds, dimmedNodeIds, hiddenEdgeIds} shape
 * applyFilterVisibility's single batched call consumes. Pure -- no adapter
 * access, no network call (AC-4). Relationship-orphan dimming (AC-3) and
 * property-filter dimming (AC-4/5) are unioned, not sequential overwrites,
 * so both survive in the one adapter call AC-7 requires. */
export function computeFilterVisibility(elements: CytoscapeElement[], state: FilterState): FilterVisibilityResult {
  const nodes = elements.filter((el) => !isEdge(el));
  const edges = elements.filter(isEdge);

  const hiddenNodeIds = computeHiddenNodeIds(nodes, state.entityTypesOff);
  const visibleNodes = nodes.filter((n) => !hiddenNodeIds.has(n.data.id));
  const hiddenEdgeIds = computeHiddenEdgeIds(edges, hiddenNodeIds, state.relTypesOff);
  const orphanedNodeIds = computeOrphanedNodeIds(edges, hiddenNodeIds, hiddenEdgeIds);

  const dimmedNodeIds = new Set(orphanedNodeIds);
  let filterMatchEmpty = false;
  if (state.propertyFilters.length > 0) {
    const matching = new Set(visibleNodes.filter((n) => evalFilters(n.data, state.propertyFilters)).map((n) => n.data.id));
    visibleNodes.filter((n) => !matching.has(n.data.id)).forEach((n) => dimmedNodeIds.add(n.data.id));
    filterMatchEmpty = matching.size === 0;
  }

  return {
    hiddenNodeIds: [...hiddenNodeIds],
    dimmedNodeIds: [...dimmedNodeIds],
    hiddenEdgeIds: [...hiddenEdgeIds],
    isEmpty: visibleNodes.length === 0,
    filterMatchEmpty,
  };
}
