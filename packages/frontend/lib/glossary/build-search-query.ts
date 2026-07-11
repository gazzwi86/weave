import { sanitizeSearchTerm } from "./sanitize-search-term";

const PREFIXES = `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>`;

export const GLOSSARY_RESULT_LIMIT = 50;

/** AC-002-01: matches case-insensitively across `skos:prefLabel`,
 * `skos:altLabel`, and `skos:definition` in one SELECT (FR-023 -- no search
 * index at M2 scale, ponytail: SPARQL CONTAINS now, index when corpus size
 * hurts). `altLabel`/`definition` are OPTIONAL, so a term missing either is
 * still found on `prefLabel` alone -- `BOUND()` guards the FILTER so an
 * absent optional never throws the whole clause away. */
export function buildGlossarySearchQuery(term: string): string {
  const safeTerm = sanitizeSearchTerm(term).toLowerCase();

  return `${PREFIXES}
SELECT ?iri ?prefLabel ?definition ?owlRole
WHERE {
  GRAPH ?g {
    ?iri a skos:Concept ;
         skos:prefLabel ?prefLabel .
    OPTIONAL { ?iri skos:altLabel ?altLabel }
    OPTIONAL { ?iri skos:definition ?definition }
    BIND(EXISTS { ?iri a owl:Class } AS ?owlRole)
    FILTER(
      CONTAINS(LCASE(STR(?prefLabel)), LCASE("${safeTerm}")) ||
      (BOUND(?altLabel) && CONTAINS(LCASE(STR(?altLabel)), LCASE("${safeTerm}"))) ||
      (BOUND(?definition) && CONTAINS(LCASE(STR(?definition)), LCASE("${safeTerm}")))
    )
  }
}
ORDER BY ?prefLabel
LIMIT ${GLOSSARY_RESULT_LIMIT}`;
}
