import { CeReadError } from "./ce-read-error";
import { mapRowsToElements } from "./map-rows-to-elements";
import type { CytoscapeElement, NodeKind, RelKind, SparqlPage } from "./types";

/** Same-origin proxy routes attach the caller's session bearer token
 * server-side (see app/api/proxy/*\/route.ts) -- the client never handles
 * the JWT directly, matching this codebase's existing auth pattern
 * (app/api/search/route.ts) rather than holding it in browser JS. */
async function proxyFetch(path: string): Promise<Response> {
  const response = await fetch(path);
  if (response.status === 401) {
    throw new CeReadError("unauthorised");
  }
  if (!response.ok) {
    throw new CeReadError(`CE error ${response.status}`);
  }
  return response;
}

/** AC-8: the bounded visible-node set. Beyond this, the system relies on
 * server-side pagination/LOD/domain-focus drill-in rather than rendering
 * everything on one canvas -- fetchGraph stops pulling further CE-READ-1
 * pages once it holds this many distinct nodes. */
export const MAX_VISIBLE_NODES = 1000;

/** AC-3: fetches the BPMO kind→colour palette. */
export async function fetchPalette(): Promise<NodeKind[]> {
  const response = await proxyFetch("/api/proxy/node-kinds");
  const data = (await response.json()) as { kinds: NodeKind[] };
  return data.kinds;
}

/** TASK-023 AC-6: the relationship-type palette for the draw-edge picker --
 * same route fetchPalette calls, its relTypes field (single CE-READ-1
 * catalogue call on the server side, no second endpoint). */
export async function fetchRelTypes(): Promise<RelKind[]> {
  const response = await proxyFetch("/api/proxy/node-kinds");
  const data = (await response.json()) as { relTypes: RelKind[] };
  return data.relTypes;
}

function assertWithinDeadline(deadline: number): void {
  if (Date.now() > deadline) {
    throw new CeReadError("timeout waiting for CE-READ-1");
  }
}

function dedupeNodes(elements: CytoscapeElement[]): CytoscapeElement[] {
  const seenNodeIds = new Set<string>();
  return elements.filter((element) => {
    if (element.data.source !== undefined) return true; // edge, keep as-is
    if (seenNodeIds.has(element.data.id)) return false;
    seenNodeIds.add(element.data.id);
    return true;
  });
}

/** AC-1: paginates CE-READ-1's SPARQL endpoint until `has_more_pages` is
 * false, or throws CeReadError on error/timeout (AC-2) with zero partial
 * elements returned to the caller. */
export async function fetchGraph(timeoutMs: number): Promise<CytoscapeElement[]> {
  const deadline = Date.now() + timeoutMs;
  const elements: CytoscapeElement[] = [];
  const nodeIds = new Set<string>();
  let page = 0;

  for (;;) {
    assertWithinDeadline(deadline);
    const response = await proxyFetch(`/api/proxy/sparql?version=latest&page=${page}`);
    const data = (await response.json()) as SparqlPage;
    const pageElements = mapRowsToElements(data.rows);
    elements.push(...pageElements);
    for (const element of pageElements) {
      if (element.data.source === undefined) nodeIds.add(element.data.id);
    }
    // AC-8: stop pulling further pages once the bounded visible-node set is
    // reached, even if CE-READ-1 still has more -- beyond this the system
    // relies on server-side pagination/LOD, not one all-at-once render.
    if (!data.has_more_pages || nodeIds.size >= MAX_VISIBLE_NODES) break;
    page += 1;
  }

  return dedupeNodes(elements);
}
