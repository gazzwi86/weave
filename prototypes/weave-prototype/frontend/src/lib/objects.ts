// Project the graph into flat rows for the Objects table view.

import type { Graph } from '../types';
import { labelOf } from './graph';

export interface ObjectRow {
  id: string;
  label: string;
  kind: string;
  color: string;
  domain: string;
  capability: string;
  comment: string;
  connections: number;
}

/** One row per node, with incident-edge count and resolved domain/capability. */
export function toObjectRows(graph: Graph): ObjectRow[] {
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  return graph.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    color: n.color,
    domain: n.domain ? labelOf(graph, n.domain) : '',
    capability: n.capability ? labelOf(graph, n.capability) : '',
    comment: n.comment ?? '',
    connections: degree.get(n.id) ?? 0,
  }));
}
