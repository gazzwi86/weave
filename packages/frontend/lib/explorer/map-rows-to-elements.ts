import type { CytoscapeElement, GraphRow } from "./types";

/** Never render a raw IRI as a label -- fall back to its last path/fragment
 * segment (AC-3's "no raw IRI exposed" carries over to node labels). */
export function lastIriSegment(iri: string): string {
  const segments = iri.split(/[/#]/).filter(Boolean);
  const segment = segments.length > 0 ? segments[segments.length - 1] : iri;
  return (segment ?? iri).replace(/_/g, " ");
}

function upsertNode(nodes: Map<string, CytoscapeElement>, iri: string, row?: GraphRow): void {
  if (nodes.has(iri)) return;
  nodes.set(iri, { data: { id: iri, label: lastIriSegment(iri), bpmo_kind: row?.bpmo_kind } });
}

export const WEAVE_ONTOLOGY_NS = "https://weave.io/ontology/";
const WEAVE_LABEL_PREDICATE = `${WEAVE_ONTOLOGY_NS}label`;
const SKOS_PREF_LABEL_PREDICATE = "http://www.w3.org/2004/02/skos/core#prefLabel";
const LABEL_PREDICATES = new Set([WEAVE_LABEL_PREDICATE, SKOS_PREF_LABEL_PREDICATE]);

/** ADR-005 #1/#2 (backend rdf/patterns.py): a node's human label is never a
 * joined-in SPARQL column -- it's its own `weave:label` (or `skos:prefLabel`
 * for glossary Concepts) triple, literal-object, same row shape as any other
 * triple. Applies it as the subject node's label instead of letting the
 * general path below turn the literal into a spurious node + edge. */
function applyLabelTriple(nodes: Map<string, CytoscapeElement>, row: GraphRow): void {
  upsertNode(nodes, row.subject);
  const node = nodes.get(row.subject);
  if (node) node.data.label = row.object;
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

/** Maps one CE-READ-1 SPARQL page's rows into Cytoscape elements. Nodes are
 * deduped within this call (a subject/object pair may repeat across rows);
 * cross-page dedup is the caller's job (fetchGraph). The raw s/p/o rows
 * carry no `bpmo_kind` column, so a node's kind (drives the AC-3 palette
 * colour) is derived from its own `rdf:type <weave-class>` row, and its
 * human label from its own `weave:label`/`skos:prefLabel` row (see
 * applyLabelTriple) -- both cases turn a triple's literal/IRI object into
 * node metadata instead of a graph edge. */
export function mapRowsToElements(rows: GraphRow[]): CytoscapeElement[] {
  const nodes = new Map<string, CytoscapeElement>();
  const edges: CytoscapeElement[] = [];

  for (const row of rows) {
    if (LABEL_PREDICATES.has(row.predicate)) {
      applyLabelTriple(nodes, row);
      continue;
    }
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
