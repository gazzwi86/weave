"""AC-6: the single choke point every SPARQL query passes through before it
reaches Oxigraph. Real parsing (rdflib), not string matching, decides
whether a query is structurally allowed.

PR #11 finding (1): a prior version of this module rewrote the query text
in place (regex substitution of `GRAPH <iri>`/`GRAPH ?var` clauses) to
force the caller's own graph. That rewrite was bypassable -- CURIE-form
GRAPH clauses (`GRAPH ws:xyz`) and comment-hidden decoys never matched the
regex, so the substitution silently no-op'd and the attacker's own graph
IRI reached Oxigraph unchanged. This module now only *validates* structure
(no rewriting at all); actual dataset scoping is enforced one layer down
by `oxigraph_client.run_query` via the SPARQL 1.1 Protocol's
default-graph-uri/named-graph-uri parameters, which Oxigraph applies
server-side to the dataset regardless of what graph IRI the query text
names -- there is no text-level substitution step left to bypass.
"""

from __future__ import annotations

from collections.abc import Iterator

from rdflib.plugins.sparql.algebra import translateQuery
from rdflib.plugins.sparql.parser import parseQuery
from rdflib.plugins.sparql.parserutils import CompValue

_ALLOWED_QUERY_TYPES = {"SelectQuery", "ConstructQuery"}


class UnscopedQueryError(Exception):
    """Raised when a query has no GRAPH clause at all -- never silently
    broadened to the default graph.
    """


class DisallowedQueryError(Exception):
    """Raised for anything but SELECT/CONSTRUCT, unparseable input, or a
    SERVICE (federation) clause.
    """


def _walk(node: object) -> Iterator[CompValue]:
    if isinstance(node, CompValue):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list | tuple):
        for item in node:
            yield from _walk(item)


def validate_query(query: str) -> None:
    """Raise unless `query` is a structurally allowed, GRAPH-scoped
    SELECT/CONSTRUCT with no dataset (FROM/FROM NAMED) clause and no
    SERVICE (federation) clause. Does not rewrite or inspect *which* graph
    IRI the query names -- dataset scoping is enforced at the protocol
    layer (see module docstring), so that's no longer this function's job.
    """
    try:
        algebra = translateQuery(parseQuery(query)).algebra
    except Exception as exc:
        raise DisallowedQueryError(f"unparseable query: {exc}") from exc

    if algebra.name not in _ALLOWED_QUERY_TYPES:
        raise DisallowedQueryError(f"query type {algebra.name} is not allowed")
    if algebra.get("datasetClause"):
        raise DisallowedQueryError("FROM/FROM NAMED dataset clauses are not allowed")

    nodes = list(_walk(algebra))
    if any(node.name == "ServiceGraphPattern" for node in nodes):
        raise DisallowedQueryError("SERVICE federation is not allowed")
    if not any(node.name == "Graph" for node in nodes):
        raise UnscopedQueryError("query has no GRAPH clause")
