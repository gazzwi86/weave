import { buildLayerQuery } from "./build-layer-query";
import { lastIriSegment } from "./map-rows-to-elements";
import type { CytoscapeElement } from "./types";

interface LayerRow {
  subject: string;
  label?: string;
  governed_object?: string;
}

export type FetchLayerNodesResult =
  | { type: "ok"; elements: CytoscapeElement[] }
  | { type: "empty" }
  | { type: "error"; status: number };

function rowLabel(iri: string, label?: string): string {
  return label ?? lastIriSegment(iri);
}

// AC-6: builds node + (governance only) governedBy-edge elements from the
// layer rows. Not mapRowsToElements -- that treats every row as a real
// triple and would turn each member's rdf:type row into a spurious
// "member -> Concept-class" edge, which this layer never selects.
function mapLayerRows(rows: LayerRow[]): CytoscapeElement[] {
  const nodes = new Map<string, CytoscapeElement>();
  const edges: CytoscapeElement[] = [];

  for (const row of rows) {
    if (!nodes.has(row.subject)) {
      nodes.set(row.subject, { data: { id: row.subject, label: rowLabel(row.subject, row.label), bpmo_kind: undefined } });
    }
    if (row.governed_object) {
      if (!nodes.has(row.governed_object)) {
        nodes.set(row.governed_object, { data: { id: row.governed_object, label: rowLabel(row.governed_object), bpmo_kind: undefined } });
      }
      edges.push({
        data: {
          id: `${row.subject}|governedBy|${row.governed_object}`,
          source: row.subject,
          target: row.governed_object,
          label: "governedBy",
        },
      });
    }
  }

  return [...nodes.values(), ...edges];
}

/** TASK-020 AC-6: fetches one governed-content layer's nodes via the
 * existing CE-READ-1 `/api/proxy/sparql` proxy (same POST-a-query pattern
 * as fetchDomainMembers). `kindIri` empty means the caller (a tenant with
 * no individuals of that kind, e.g. no Brand content) never had one
 * configured -- resolves to `{type: "empty"}` (AC-6's disable-toggle path)
 * without a network call. Never throws. */
export async function fetchLayerNodes(
  kindIri: string,
  governedByPredicate: string | undefined,
  timeoutMs: number
): Promise<FetchLayerNodesResult> {
  if (!kindIri) return { type: "empty" };

  let query: string;
  try {
    query = buildLayerQuery(kindIri, governedByPredicate);
  } catch {
    return { type: "error", status: 422 };
  }

  let response: Response;
  try {
    response = await fetch("/api/proxy/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as { rows: LayerRow[] };
  if (body.rows.length === 0) return { type: "empty" };
  return { type: "ok", elements: mapLayerRows(body.rows) };
}
