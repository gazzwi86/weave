import { CeReadError } from "./ce-read-error";
import { mapRowsToElements } from "./map-rows-to-elements";
import type { CytoscapeElement, NodeKind, SparqlPage } from "./types";

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

/** AC-3: fetches the BPMO kind→colour palette. */
export async function fetchPalette(): Promise<NodeKind[]> {
  const response = await proxyFetch("/api/proxy/node-kinds");
  const data = (await response.json()) as { kinds: NodeKind[] };
  return data.kinds;
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
  let page = 0;

  for (;;) {
    assertWithinDeadline(deadline);
    const response = await proxyFetch(`/api/proxy/sparql?version=latest&page=${page}`);
    const data = (await response.json()) as SparqlPage;
    elements.push(...mapRowsToElements(data.rows));
    if (!data.has_more_pages) break;
    page += 1;
  }

  return dedupeNodes(elements);
}
