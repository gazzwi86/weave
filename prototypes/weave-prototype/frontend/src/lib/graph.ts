// Small shared helpers over the graph model, reused by the inspector and views.

import type { Graph } from '../types';

/** Human-readable local part of an IRI (after '#', else after the last '/'). */
export function localName(id: string): string {
  const parts = id.split(/[#/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : id;
}

/** Resolve a node id to its label, falling back to the IRI local name. */
export function labelOf(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.label ?? localName(id);
}
