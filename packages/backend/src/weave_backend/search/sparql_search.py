"""PLAT-TASK-005 AC-3: builds the tenant-scoped entity-search SPARQL query
run through the same choke point every other query goes through --
`rdf/query_rewriter.validate_query` (structure) then
`rdf/oxigraph_client.run_query` (dataset scoped to the caller's own
workspace named graph, via the SPARQL 1.1 Protocol params -- see that
module's docstring). `GRAPH ?g` (a variable, not a specific IRI) matches
the existing precedent in `test_tenancy_isolation.py`'s cross-tenant proof;
the query text never needs to name a graph for the dataset scoping to hold.
"""

from __future__ import annotations

import re

MIN_QUERY_LENGTH = 2
_RESULT_LIMIT = 20

# Law 13: untrusted input never reaches the query text unsanitised. Oxigraph's
# SPARQL 1.1 Protocol has no bind-parameter mechanism, so this is an
# allowlist strip, not a parameterised query -- it removes exactly the
# characters that could close the `"..."` string literal (`"`) or open a new
# clause (`<`/`>` IRI refs, `{`/`}` graph-pattern blocks, `;` chaining).
_UNSAFE_CHARS = re.compile(r'[<>"{};]')


def sanitize_search_term(term: str) -> str:
    return _UNSAFE_CHARS.sub("", term)


def build_search_query(term: str) -> str:
    """Case-insensitive substring match over `rdfs:label`, with the entity's
    `rdf:type` (if any) returned as `?kind`. Caller is responsible for the
    `len(term) < MIN_QUERY_LENGTH` short-circuit (kept out of this pure
    query-building function).
    """
    safe_term = sanitize_search_term(term)
    return f"""
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?iri ?label ?kind WHERE {{
      GRAPH ?g {{
        ?iri rdfs:label ?label .
        OPTIONAL {{ ?iri a ?kind }}
        FILTER(CONTAINS(LCASE(?label), LCASE("{safe_term}")))
      }}
    }}
    LIMIT {_RESULT_LIMIT}
    """
