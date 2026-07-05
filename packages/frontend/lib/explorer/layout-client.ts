import type { CytoscapeElement } from "./types";

export interface SavedLayoutPosition {
  node_iri: string;
  position_x: number;
  position_y: number;
  locked: boolean;
}

/** AC-3/AC-5: reads a graph's saved node positions via the same-origin proxy
 * route (app/api/proxy/layout-positions/route.ts) -- the client never holds
 * the bearer token directly (matches fetch-graph.ts's proxyFetch pattern).
 *
 * Deliberately non-fatal: unlike fetchGraph/fetchPalette (which throw
 * CeReadError), a down layout-persistence backend degrades to "no saved
 * layout" rather than blocking the whole Explorer canvas -- restoring node
 * positions is an enhancement on top of CE-READ-1's graph data, not a
 * dependency of it. */
export async function fetchLayoutPositions(graphId: string): Promise<SavedLayoutPosition[]> {
  try {
    const response = await fetch(`/api/proxy/layout-positions?graph_id=${encodeURIComponent(graphId)}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { positions: SavedLayoutPosition[] };
    return data.positions;
  } catch {
    return [];
  }
}

/** AC-1: persists a single dragged node's position. Throws on failure so
 * the caller (use-layout-persistence.ts) can drive its own retry/backoff. */
export async function saveLayoutPosition(
  graphId: string,
  nodeIri: string,
  positionX: number,
  positionY: number
): Promise<void> {
  const response = await fetch("/api/proxy/layout-positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graph_id: graphId, node_iri: nodeIri, position_x: positionX, position_y: positionY }),
  });
  if (!response.ok) throw new Error(`layout save failed: ${response.status}`);
}

/** AC-4: clears every saved position for a graph so the next fcose run
 * randomizes again. */
export async function resetLayoutPositions(graphId: string): Promise<void> {
  const response = await fetch(`/api/proxy/layout-positions?graph_id=${encodeURIComponent(graphId)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`layout reset failed: ${response.status}`);
}

/** AC-3/AC-5: merges each saved position onto its matching element's
 * `position` field (Cytoscape's native sibling-to-`data` position slot)
 * before the initial `canvasAdapter.load(elements)` call. */
export function applySavedPositions(
  elements: CytoscapeElement[],
  positions: SavedLayoutPosition[]
): CytoscapeElement[] {
  if (positions.length === 0) return elements;
  const byNodeIri = new Map(positions.map((position) => [position.node_iri, position]));
  return elements.map((element) => {
    const saved = byNodeIri.get(element.data.id);
    return saved ? { ...element, position: { x: saved.position_x, y: saved.position_y } } : element;
  });
}
