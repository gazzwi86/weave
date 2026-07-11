/** AC-002-01: mirrors the backend's `search/sparql_search.py::sanitize_search_term`
 * regex so a free-text glossary search term can never break out of the
 * SPARQL string literal it is interpolated into (Law 13 -- validated at the
 * boundary, never cast). Strips, never throws: an ordinary user typing
 * `invoice"` should keep searching, not see a crash. */
const UNSAFE_LITERAL_CHARS = /[<>"{};\\]/g;

export function sanitizeSearchTerm(term: string): string {
  return term.replace(UNSAFE_LITERAL_CHARS, "");
}
