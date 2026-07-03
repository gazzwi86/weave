"""AC-6: the single choke point every SPARQL query passes through before it
reaches Oxigraph. Real parsing (rdflib), not string matching, decides
whether a query is scoped -- only the mechanical substitution step (after
that decision is already made) uses a regex.
"""

from __future__ import annotations

import re
from collections.abc import Iterator

from rdflib.plugins.sparql.algebra import translateQuery
from rdflib.plugins.sparql.parser import parseQuery
from rdflib.plugins.sparql.parserutils import CompValue

_ALLOWED_QUERY_TYPES = {"SelectQuery", "ConstructQuery"}
_GRAPH_CLAUSE_RE = re.compile(r"GRAPH\s+(?:<[^>]*>|\?\w+)", re.IGNORECASE)


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


def rewrite_query(query: str, named_graph_iri: str) -> str:
    """Validate `query` and rewrite every GRAPH clause (whether it names a
    literal graph or a variable) to `named_graph_iri`, ignoring whatever the
    caller wrote -- the caller's own graph selection is never trusted.
    """
    try:
        algebra = translateQuery(parseQuery(query)).algebra
    except Exception as exc:
        raise DisallowedQueryError(f"unparseable query: {exc}") from exc

    if algebra.name not in _ALLOWED_QUERY_TYPES:
        raise DisallowedQueryError(f"query type {algebra.name} is not allowed")

    nodes = list(_walk(algebra))
    if any(node.name == "ServiceGraphPattern" for node in nodes):
        raise DisallowedQueryError("SERVICE federation is not allowed")
    if not any(node.name == "Graph" for node in nodes):
        raise UnscopedQueryError("query has no GRAPH clause")

    rewritten = _GRAPH_CLAUSE_RE.sub(f"GRAPH <{named_graph_iri}>", query)
    translateQuery(parseQuery(rewritten))  # re-validate: rewrite must still parse
    return rewritten
