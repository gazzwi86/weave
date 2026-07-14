import type { CytoscapeElement } from "./types";

export interface SliceResult {
  elements: CytoscapeElement[];
  /** false when `filterByIri` names no node in the input graph -- the
   * caller (graph-canvas.tsx) renders empty-state, never an error
   * (ge-canvas-1.md rule 2). */
  matched: boolean;
}

function isNode(element: CytoscapeElement): boolean {
  return element.data.source === undefined;
}

/** BFS outward from `filterByIri` over undirected adjacency, `hopDepth`
 * hops -- ge-canvas-1.md rule 8's "project slice." ponytail: adjacency-only
 * traversal (no TASK-028 closure/predicate config); swap for the closure
 * config's traversal once TASK-028 lands (brief's soft-dependency escape
 * hatch), same slice/stub-marker output shape either way. */
function reachableNodeIds(edges: CytoscapeElement[], root: string, hopDepth: number): Set<string> {
  const inSlice = new Set<string>([root]);
  let frontier = [root];
  for (let hop = 0; hop < hopDepth && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const edge of edges) {
      const { source, target } = edge.data;
      if (source === undefined || target === undefined) continue;
      if (frontier.includes(source) && !inSlice.has(target)) {
        inSlice.add(target);
        next.push(target);
      }
      if (frontier.includes(target) && !inSlice.has(source)) {
        inSlice.add(source);
        next.push(source);
      }
    }
    frontier = next;
  }
  return inSlice;
}

/** A boundary edge (one endpoint outside the slice) renders as a stub
 * marker on the in-slice node -- a small pseudo-node cytoscape can render a
 * dot for, never the real out-of-slice node (ge-canvas-1.md rule 8). */
function stubMarkerFor(edge: CytoscapeElement, inSliceNodeId: string): [CytoscapeElement, CytoscapeElement] {
  const stubNodeId = `${edge.data.id}::boundary-stub`;
  return [
    { data: { id: stubNodeId, label: "", stub: true } },
    { data: { id: `${edge.data.id}::stub-edge`, source: inSliceNodeId, target: stubNodeId, label: edge.data.label, boundary_stub: true } },
  ];
}

/** ge-canvas-1.md rule 8: slice = `filterByIri` plus nodes reachable within
 * `hopDepth`. In-slice edges render normally; boundary edges render as stub
 * markers on the in-slice node -- the out-of-slice node is never pulled in.
 * Deterministic for a fixed (elements, filterByIri, hopDepth). */
export function computeSlice(elements: CytoscapeElement[], filterByIri: string, hopDepth: number): SliceResult {
  const nodes = elements.filter(isNode);
  const edges = elements.filter((element) => !isNode(element));
  if (!nodes.some((node) => node.data.id === filterByIri)) {
    return { elements: [], matched: false };
  }

  const inSlice = reachableNodeIds(edges, filterByIri, hopDepth);
  const sliceElements: CytoscapeElement[] = nodes.filter((node) => inSlice.has(node.data.id));

  for (const edge of edges) {
    const { source, target } = edge.data;
    if (source === undefined || target === undefined) continue;
    const sourceIn = inSlice.has(source);
    const targetIn = inSlice.has(target);
    if (sourceIn && targetIn) {
      sliceElements.push(edge);
    } else if (sourceIn || targetIn) {
      sliceElements.push(...stubMarkerFor(edge, sourceIn ? source : target));
    }
  }

  return { elements: sliceElements, matched: true };
}
