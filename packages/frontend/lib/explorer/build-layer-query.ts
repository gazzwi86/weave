import { assertSafeIriTerm } from "./sparql-safe";

const PREFIXES = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

/** TASK-020 AC-6: one query per governed-content layer (Glossary/Brand
 * pass no `governedByPredicate`; Governance does). `kindIri` and
 * `governedByPredicate` are always caller-supplied (config, see
 * ExplorerConfig) -- this file never embeds a kind/predicate IRI literal
 * (invariants-explorer.md). `?governed_object` stays unbound when no
 * predicate is given, which the backend proxy reports as an empty column,
 * not an error. */
export function buildLayerQuery(kindIri: string, governedByPredicate?: string): string {
  const safeKindIri = assertSafeIriTerm(kindIri);
  const governedByClause = governedByPredicate
    ? `\n    OPTIONAL { ?subject <${assertSafeIriTerm(governedByPredicate)}> ?governed_object . }`
    : "";

  return `${PREFIXES}
SELECT ?subject ?label ?governed_object
WHERE {
  GRAPH ?g {
    ?subject rdf:type <${safeKindIri}> .
    OPTIONAL { ?subject rdfs:label ?label . }${governedByClause}
  }
}`;
}
