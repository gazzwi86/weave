"""CE-TASK-007 AC-007-12/-13: named, stored SPARQL SELECT patterns exposed
via `GET /api/sparql?pattern=<name>` (never a separate hard-coded route --
Implementation Hints). Every pattern still passes through
`query_rewriter.validate_query` before execution (AC-007-10), same as any
other query on this endpoint -- these are trusted text, not user input, but
the choke point is uniform regardless of source.

ADR-005 #1/#2: the step label predicate is `weave:label` (not the brief's
literal `rdfs:label` -- there is no `rdfs:label` triple in a Weave graph,
see `operations/graph_ops.py`), and the query is `GRAPH ?g`-wrapped like
every other query on this path (`validate_query` 400s an unscoped SELECT).
"""

from __future__ import annotations

_COVERAGE_GAP_PROCESS = """
PREFIX weave: <https://weave.io/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?process_iri ?step_iri ?step_label ?gap_reason
WHERE {
  GRAPH ?g {
    ?process_iri a weave:Process ;
                  weave:hasStep ?step_iri .
    ?step_iri weave:label ?step_label .
    FILTER NOT EXISTS {
      { ?step_iri weave:performedBy ?actor . }
      UNION
      { ?step_iri weave:supportedBy ?system . }
    }
    BIND("No actor or system assigned" AS ?gap_reason)
  }
}
"""

#: Pattern name -> SPARQL SELECT text. New patterns are added here, never as
#: their own route (Implementation Hints).
NAMED_PATTERNS: dict[str, str] = {
    "coverage_gap_process": _COVERAGE_GAP_PROCESS,
}

#: AC-007-13: the message shown when a pattern legitimately returns zero
#: rows, keyed the same as NAMED_PATTERNS. Patterns with no entry here fall
#: back to a generic message (see `routers/sparql.py::_pattern_response`).
ZERO_ROW_MESSAGES: dict[str, str] = {
    "coverage_gap_process": "No coverage gaps found",
}
