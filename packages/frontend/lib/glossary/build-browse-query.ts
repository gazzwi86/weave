const PREFIXES = `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>`;

export const GLOSSARY_PAGE_SIZE = 50;

/** AC-002-03: 50/page, ordered by prefLabel, broader/narrower rolled up
 * with GROUP_CONCAT so one term is one row (a plain triple pattern would
 * cross-product a row per relationship). ADR-glossary-pagination: the
 * backend's CE-READ-1 `page=` parameter is a fixed 1000-row slice
 * (`routers/sparql.py::_PAGE_SIZE`), not a configurable page size, so "50
 * via `page=`" is satisfied as page-*number* pagination -- LIMIT/OFFSET
 * computed here from the same 1-indexed page convention, always requesting
 * backend `page=1` -- rather than a literal reuse of the coarser backend
 * slice. See docs/specs/weave/engines/constitution-engine/decisions/. */
export function buildGlossaryBrowseQuery(page: number): string {
  const offset = (page - 1) * GLOSSARY_PAGE_SIZE;

  return `${PREFIXES}
SELECT ?iri ?prefLabel ?definition ?owlRole
  (GROUP_CONCAT(DISTINCT STR(?broaderIri); separator="|") AS ?broader)
  (GROUP_CONCAT(DISTINCT STR(?narrowerIri); separator="|") AS ?narrower)
WHERE {
  GRAPH ?g {
    ?iri a skos:Concept ;
         skos:prefLabel ?prefLabel .
    OPTIONAL { ?iri skos:definition ?definition }
    BIND(EXISTS { ?iri a owl:Class } AS ?owlRole)
    OPTIONAL { ?iri skos:broader ?broaderIri }
    OPTIONAL { ?iri skos:narrower ?narrowerIri }
  }
}
GROUP BY ?iri ?prefLabel ?definition ?owlRole
ORDER BY ?prefLabel
LIMIT ${GLOSSARY_PAGE_SIZE}
OFFSET ${offset}`;
}
