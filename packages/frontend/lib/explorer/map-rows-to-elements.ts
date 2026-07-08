import type { CytoscapeElement, GraphRow } from "./types";

/** Never render a raw IRI as a label -- fall back to its last path/fragment
 * segment (AC-3's "no raw IRI exposed" carries over to node labels). */
function lastIriSegment(iri: string): string {
  const segments = iri.split(/[/#]/).filter(Boolean);
  const segment = segments.length > 0 ? segments[segments.length - 1] : iri;
  return (segment ?? iri).replace(/_/g, " ");
}

function nodeLabel(iri: string, row?: GraphRow): string {
  return row?.skos_pref_label ?? row?.label ?? lastIriSegment(iri);
}

function upsertNode(nodes: Map<string, CytoscapeElement>, iri: string, row?: GraphRow): void {
  if (nodes.has(iri)) return;
  nodes.set(iri, { data: { id: iri, label: nodeLabel(iri, row), bpmo_kind: row?.bpmo_kind } });
}

function buildEdge(row: GraphRow): CytoscapeElement {
  return {
    data: {
      id: `${row.subject}|${row.predicate}|${row.object}`,
      source: row.subject,
      target: row.object,
      label: row.predicate,
    },
  };
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const WEAVE_ONTOLOGY_NS = "https://weave.io/ontology/";

/** Maps one CE-READ-1 SPARQL page's rows into Cytoscape elements. Nodes are
 * deduped within this call (a subject/object pair may repeat across rows);
 * cross-page dedup is the caller's job (fetchGraph). The raw s/p/o rows
 * carry no `bpmo_kind` column, so a node's kind (drives the AC-3 palette
 * colour) is derived from its own `rdf:type <weave-class>` row. */
export function mapRowsToElements(rows: GraphRow[]): CytoscapeElement[] {
  const nodes = new Map<string, CytoscapeElement>();
  const edges: CytoscapeElement[] = [];

  for (const row of rows) {
    upsertNode(nodes, row.subject, row);
    upsertNode(nodes, row.object);
    edges.push(buildEdge(row));
    if (row.predicate === RDF_TYPE && row.object.startsWith(WEAVE_ONTOLOGY_NS)) {
      const node = nodes.get(row.subject);
      if (node && node.data.bpmo_kind === undefined) {
        node.data.bpmo_kind = row.object.slice(WEAVE_ONTOLOGY_NS.length);
      }
    }
  }

  return [...nodes.values(), ...edges];
}
