const _PREFIX = "PREFIX weave: <https://weave.io/ontology/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>";

// Same one-extra-row pagination trick as brand/queries.ts.
const PAGE_SIZE = 50;

function offsetFor(page: number): number {
  return Math.max(0, Math.floor(page)) * PAGE_SIZE;
}

export interface PolicyRow {
  iri: string;
  label: string;
}

/** Policies tab list (list + attach, no create form -- Policy is created via
 * the generic instances authoring flow like any other BPMO kind). Reads the
 * draft graph via the arbitrary-SELECT proxy, same posture as brand's lists
 * (task brief Design Decision: not the CE-BRAND-1 projection).
 */
export function policiesQuery(page: number): string {
  return `${_PREFIX}
SELECT ?s ?label WHERE {
  ?s a weave:Policy .
  OPTIONAL { ?s rdfs:label ?label }
}
ORDER BY ?s
LIMIT ${PAGE_SIZE + 1} OFFSET ${offsetFor(page)}
`;
}

function localName(iri: string): string {
  const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"), iri.lastIndexOf(":"));
  return iri.slice(cut + 1);
}

interface SparqlRow {
  [variable: string]: string | undefined;
}

export function toPolicyRow(row: SparqlRow): PolicyRow {
  const iri = row.s ?? "";
  return { iri, label: row.label ?? localName(iri) };
}
