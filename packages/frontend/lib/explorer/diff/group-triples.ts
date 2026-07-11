import { lastIriSegment } from "../map-rows-to-elements";
import type { CytoscapeElement } from "../types";
import type { DiffResponse } from "./types";

export interface DiffEdgeRef {
  id: string;
  source: string;
  target: string;
  predicate: string;
}

export interface GroupedDiff {
  addedNodeIds: string[];
  addedEdgeRefs: DiffEdgeRef[];
  modifiedNodeIds: string[];
  modifiedEdgeRefs: DiffEdgeRef[];
  /** AC-3/hint: removed elements aren't in the loaded draft graph -- ghost
   * CytoscapeElements the diff overlay adds then removes on deactivate. */
  removedNodeGhosts: CytoscapeElement[];
  removedEdgeGhosts: CytoscapeElement[];
  /** Minimal endpoint ghost nodes a removed edge needs to attach to (may
   * overlap removedNodeGhosts; addLayerNodes dedupes against the live canvas). */
  removedGhostNodes: CytoscapeElement[];
  counts: { added: number; removed: number; modified: number };
}

function edgeId(source: string, predicate: string, target: string): string {
  return `${source}|${predicate}|${target}`;
}

function ghostNode(iri: string): CytoscapeElement {
  return { data: { id: iri, label: lastIriSegment(iri) } };
}

function edgeRef(subject: string, predicate: string, object: string): DiffEdgeRef {
  return { id: edgeId(subject, predicate, object), source: subject, target: object, predicate };
}

/** Pseudocode `groupTriples`: predicate in the relationship-predicate set
 * (config, from CE-READ-1 types, never a literal) -> edge change; anything
 * else -> node-property change. CE-DIFF-1 emits no reification quads, so
 * this single rule is complete (no second grouping rule needed). */
export function groupTriples(diff: DiffResponse, relationshipPredicates: Set<string>): GroupedDiff {
  const isEdge = (predicate: string) => relationshipPredicates.has(predicate);

  const addedNodeIds = diff.added.filter((t) => !isEdge(t.predicate)).map((t) => t.subject);
  const addedEdgeRefs = diff.added.filter((t) => isEdge(t.predicate)).map((t) => edgeRef(t.subject, t.predicate, t.object));

  const modifiedNodeIds = diff.modified.filter((t) => !isEdge(t.predicate)).map((t) => t.subject);
  const modifiedEdgeRefs = diff.modified
    .filter((t) => isEdge(t.predicate))
    .map((t) => edgeRef(t.subject, t.predicate, t.after));

  const removedNodeTriples = diff.removed.filter((t) => !isEdge(t.predicate));
  const removedEdgeTriples = diff.removed.filter((t) => isEdge(t.predicate));

  const removedNodeGhosts = removedNodeTriples.map((t) => ghostNode(t.subject));
  const removedEdgeGhosts = removedEdgeTriples.map((t) => ({
    data: { id: edgeId(t.subject, t.predicate, t.object), source: t.subject, target: t.object, label: t.predicate },
  }));
  const removedGhostNodeIds = new Set<string>();
  removedNodeTriples.forEach((t) => removedGhostNodeIds.add(t.subject));
  removedEdgeTriples.forEach((t) => {
    removedGhostNodeIds.add(t.subject);
    removedGhostNodeIds.add(t.object);
  });

  return {
    addedNodeIds,
    addedEdgeRefs,
    modifiedNodeIds,
    modifiedEdgeRefs,
    removedNodeGhosts,
    removedEdgeGhosts,
    removedGhostNodes: [...removedGhostNodeIds].map(ghostNode),
    counts: { added: diff.added.length, removed: diff.removed.length, modified: diff.modified.length },
  };
}
