const LABEL_PREDICATE_IRI = "https://weave.io/ontology/label";

export const PAGE_SIZE = 50;

export interface BrowseQueryParams {
  kindIri: string | null;
  searchTerm: string;
  page: number;
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** AC-1/AC-2: TASK-005's browse query shape (`?iri ?label ?kind`,
 * `LIMIT 50 OFFSET n`), reused verbatim per the brief's implementation
 * hint, extended with the kind-chip and search FILTERs. Both filters sit
 * in the same WHERE block -- SPARQL FILTERs in one block AND together by
 * construction, which is the AC-2 intersection semantics (never OR).
 */
export function buildBrowseQuery({ kindIri, searchTerm, page }: BrowseQueryParams): string {
  const offset = (page - 1) * PAGE_SIZE;
  const filters = [`FILTER(BOUND(?label))`];
  if (searchTerm.trim() !== "") {
    filters.push(`FILTER(CONTAINS(LCASE(?label), "${escapeSparqlLiteral(searchTerm.trim().toLowerCase())}"))`);
  }
  if (kindIri) {
    filters.push(`FILTER(?kind = <${kindIri}>)`);
  }
  // The WHERE body sits inside `GRAPH ?g { ... }` -- the backend's
  // validate_query 400s any SELECT with no GRAPH clause (unscoped_query_rejected),
  // exactly like rdf/patterns.py and app/ce/brand/queries.ts. Dataset scoping is
  // still pinned server-side via the version param (protocol layer), the wrap
  // only satisfies the structural "is this query scoped?" gate.
  return [
    "SELECT ?iri ?label ?kind WHERE {",
    "  GRAPH ?g {",
    "    ?iri a ?kind .",
    `    OPTIONAL { ?iri <${LABEL_PREDICATE_IRI}> ?label }`,
    `    ${filters.join(" ")}`,
    "  }",
    `} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
  ].join("\n");
}
