export interface KeyProperty {
  path: string;
  label: string;
  value: string;
}

/** TASK-005 AC-3: one immediate neighbour, as returned by this same
 * endpoint's `neighbours` field -- neighbour expansion reuses this fetch
 * (already issued to show the side panel) instead of a second CE-READ-1
 * round trip. */
export interface NeighbourProps {
  iri: string;
  label: string;
  bpmoKind: string;
  edgePredicate: string;
  edgeDirection: "outgoing" | "incoming";
}

export interface NodeProps {
  label: string;
  typeLabel: string;
  bpmoKind?: string;
  keyProperties: KeyProperty[];
  /** AC-2: only present (non-null) for the ontologist role -- decided
   * server-side by the proxy route, never a client-side flag. */
  rawIri: string | null;
  neighbours: NeighbourProps[];
}

export type FetchNodePropsResult = { type: "ok"; data: NodeProps } | { type: "error"; status: number };

interface CeResourceNeighbourBody {
  iri: string;
  label: string;
  bpmo_kind: string;
  edge_predicate: string;
  edge_direction: "outgoing" | "incoming";
}

interface CeResourceResponseBody {
  label: string;
  type_label: string;
  bpmo_kind?: string;
  key_properties: KeyProperty[];
  raw_iri: string | null;
  neighbours?: CeResourceNeighbourBody[];
}

function mapNeighbour(neighbour: CeResourceNeighbourBody): NeighbourProps {
  return {
    iri: neighbour.iri,
    label: neighbour.label,
    bpmoKind: neighbour.bpmo_kind,
    edgePredicate: neighbour.edge_predicate,
    edgeDirection: neighbour.edge_direction,
  };
}

function isAbsoluteIri(iri: string): boolean {
  try {
    new URL(iri);
    return true;
  } catch {
    return false;
  }
}

/** AC-2/AC-3/AC-8: fetches a node's properties via the same-origin proxy
 * route (the client never handles the JWT directly -- see fetch-graph.ts's
 * proxyFetch). Never throws: every failure (validation, HTTP error,
 * timeout/network) resolves to `{type: "error", status}` so callers can
 * render a fallback instead of crashing. */
export async function fetchNodeProps(iri: string, timeoutMs: number): Promise<FetchNodePropsResult> {
  if (!isAbsoluteIri(iri)) return { type: "error", status: 422 };

  let response: Response;
  try {
    response = await fetch(`/api/proxy/ontology/resource/${encodeURIComponent(iri)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as CeResourceResponseBody;
  return {
    type: "ok",
    data: {
      label: body.label,
      typeLabel: body.type_label,
      bpmoKind: body.bpmo_kind,
      keyProperties: body.key_properties,
      rawIri: body.raw_iri,
      neighbours: (body.neighbours ?? []).map(mapNeighbour),
    },
  };
}
