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
from typing import NoReturn

from rdflib.plugins.sparql.algebra import translateQuery, translateUpdate
from rdflib.plugins.sparql.parser import parseQuery, parseUpdate
from rdflib.plugins.sparql.parserutils import CompValue

_ALLOWED_QUERY_TYPES = {"SelectQuery", "ConstructQuery"}

#: AC-003-05: SPARQL Update request algebra names (rdflib's `translateUpdate`
#: output), mapped to the clause label the CE-READ-1 error body reports.
#: Anything not listed here (Modify, Load, Clear, Create, Drop, Add, Move,
#: Copy) is a generic "UPDATE" -- INSERT/DELETE only get their own precise
#: label when the statement is *purely* one or the other (`InsertData`/
#: `DeleteData`/`DeleteWhere`).
_UPDATE_CLAUSE_LABELS = {"InsertData": "INSERT", "DeleteData": "DELETE", "DeleteWhere": "DELETE"}
_DEFAULT_UPDATE_CLAUSE_LABEL = "UPDATE"


class UnscopedQueryError(Exception):
    """Raised when a query has no GRAPH clause at all -- never silently
    broadened to the default graph.
    """


class DisallowedQueryError(Exception):
    """Raised for anything but SELECT/CONSTRUCT, unparseable input, or a
    SERVICE (federation) clause.
    """


class ProhibitedClauseError(DisallowedQueryError):
    """AC-003-05: a SPARQL Update statement (INSERT/DELETE/UPDATE) reached
    the read-only choke point. Carries `clause` so the router can report
    `{error: "prohibited_clause", clause: "<name>"}` without re-parsing the
    message string.
    """

    def __init__(self, clause: str) -> None:
        self.clause = clause
        super().__init__(f"{clause} clause is not allowed")


class ServiceBlockedError(DisallowedQueryError):
    """AC-003-06: SERVICE federation (an SSRF vector) is reported as its own
    error shape (`service_blocked`), distinct from the other prohibited
    clauses above.
    """


def _reject_as_update_or_unparseable(query: str, parse_exc: Exception) -> NoReturn:
    """`query` failed the SPARQL Query grammar -- check whether it's a valid
    SPARQL *Update* statement instead (AST-level, not regex: rdflib's own
    update parser/algebra decides this) before giving up as unparseable.
    """
    try:
        update_algebra = translateUpdate(parseUpdate(query))
    except Exception:
        raise DisallowedQueryError(f"unparseable query: {parse_exc}") from parse_exc

    first_request = update_algebra.algebra[0] if update_algebra.algebra else None
    request_name = first_request.name if first_request is not None else ""
    raise ProhibitedClauseError(
        _UPDATE_CLAUSE_LABELS.get(request_name, _DEFAULT_UPDATE_CLAUSE_LABEL)
    )


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
        _reject_as_update_or_unparseable(query, exc)

    if algebra.name not in _ALLOWED_QUERY_TYPES:
        raise DisallowedQueryError(f"query type {algebra.name} is not allowed")
    if algebra.get("datasetClause"):
        raise DisallowedQueryError("FROM/FROM NAMED dataset clauses are not allowed")

    nodes = list(_walk(algebra))
    if any(node.name == "ServiceGraphPattern" for node in nodes):
        raise ServiceBlockedError("SERVICE federation is not allowed")
    if not any(node.name == "Graph" for node in nodes):
        raise UnscopedQueryError("query has no GRAPH clause")
