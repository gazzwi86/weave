import type { Graph, DiffMap } from '../types';

/**
 * Compute a diff between a baseline Graph (snapshot) and the current live Graph.
 * Returns a Map from node/edge ID to its diff status.
 */
export function computeGraphDiff(baseline: Graph, current: Graph): DiffMap {
  const result: DiffMap = new Map();

  const baseNodes = new Map(baseline.nodes.map((n) => [n.id, n]));
  const currNodes = new Map(current.nodes.map((n) => [n.id, n]));
  const baseEdges = new Map(baseline.edges.map((e) => [e.id, e]));
  const currEdges = new Map(current.edges.map((e) => [e.id, e]));

  // Added: in current but not in baseline
  for (const id of currNodes.keys()) {
    if (!baseNodes.has(id)) result.set(id, 'added');
  }
  // Removed: in baseline but not in current
  for (const id of baseNodes.keys()) {
    if (!currNodes.has(id)) result.set(id, 'removed');
  }
  // Modified: in both but different key fields
  for (const [id, curr] of currNodes) {
    const base = baseNodes.get(id);
    if (base && !result.has(id)) {
      if (
        base.label !== curr.label ||
        base.kind !== curr.kind ||
        base.comment !== curr.comment ||
        base.domain !== curr.domain ||
        base.capability !== curr.capability
      ) {
        result.set(id, 'modified');
      }
    }
  }

  // Edge diffs
  for (const id of currEdges.keys()) {
    if (!baseEdges.has(id)) result.set(id, 'added');
  }
  for (const id of baseEdges.keys()) {
    if (!currEdges.has(id)) result.set(id, 'removed');
  }

  return result;
}

export function diffSummary(diff: DiffMap): { added: number; removed: number; modified: number } {
  let added = 0, removed = 0, modified = 0;
  for (const status of diff.values()) {
    if (status === 'added') added++;
    else if (status === 'removed') removed++;
    else modified++;
  }
  return { added, removed, modified };
}
