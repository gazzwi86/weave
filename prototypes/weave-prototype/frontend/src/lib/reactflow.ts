// Map the Weave graph model into React Flow nodes + edges.

import type { Edge, Node } from '@xyflow/react';
import type { Graph, NodeKind } from '../types';
import { colorForNode } from './colors';

const COL_GAP = 200;
const ROW_GAP = 110;
const COLS = 5;

/** Place nodes on a simple grid; honour stored x/y when present. */
export function graphToFlow(
  graph: Graph,
  kinds?: NodeKind[],
): { nodes: Node[]; edges: Edge[] } {
  const ids = new Set(graph.nodes.map((n) => n.id));

  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    position: {
      x: n.x ?? (i % COLS) * COL_GAP,
      y: n.y ?? Math.floor(i / COLS) * ROW_GAP,
    },
    data: { label: n.label },
    style: { background: colorForNode(n, kinds) },
    className: 'rf-node',
  }));

  const edges: Edge[] = graph.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
    }));

  return { nodes, edges };
}
