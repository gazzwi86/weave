"""AC-6: the SPARQL choke point rejects anything not scoped to a single
named graph *before* it reaches Oxigraph, using real algebra parsing
(rdflib) rather than string matching.

PR #11 finding (1): a text-level rewrite step is bypassable (CURIE-form
`GRAPH` clauses, comment-hidden decoys) because it only ever inspects/edits
the raw query string. `validate_query` no longer rewrites anything -- it
only validates structure (allowed query type, no SERVICE, no FROM/FROM
NAMED dataset clause, exactly a GRAPH-scoped pattern) and raises on
anything else. Actual scoping happens one layer down, in
`oxigraph_client.run_query`, via the SPARQL 1.1 Protocol's
default-graph-uri/named-graph-uri parameters -- enforced by Oxigraph
itself against the *dataset*, not the query text, so no rewrite step is
left to bypass. See `tests/integration/test_tenancy_isolation.py` for the
real-Oxigraph proof that a CURIE-form GRAPH clause naming a foreign graph
still can't read foreign data once dataset-scoped this way.
"""

from __future__ import annotations

import pytest

from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    ProhibitedClauseError,
    ServiceBlockedError,
    UnscopedQueryError,
    validate_query,
)


def test_sparql_unscoped_query_rejected() -> None:
    with pytest.raises(UnscopedQueryError):
        validate_query("SELECT * WHERE { ?s ?p ?o }")


def test_sparql_scoped_select_query_is_valid() -> None:
    validate_query("SELECT * WHERE { GRAPH <urn:whatever:caller-supplied> { ?s ?p ?o } }")


def test_sparql_construct_query_allowed() -> None:
    validate_query("CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s ?p ?o } }")


def test_sparql_ask_query_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        validate_query("ASK { GRAPH ?g { ?s ?p ?o } }")


def test_sparql_service_federation_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        validate_query(
            "SELECT * WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> { ?s ?p ?o } } }"
        )


def test_sparql_unparseable_query_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        validate_query("not a sparql query at all")


def test_sparql_curie_graph_clause_still_recognised_as_scoped() -> None:
    """A CURIE-form GRAPH clause (`GRAPH ws:xyz`, not `GRAPH <iri>`) must
    still parse as a valid, GRAPH-scoped query -- rdflib's algebra resolves
    the CURIE to a full IRI before this check ever runs, so structural
    validation isn't fooled by CURIE vs. angle-bracket syntax. (Whether the
    IRI it names is the caller's *own* graph is no longer this function's
    job at all -- see module docstring.)
    """
    query = (
        "PREFIX ws: <urn:weave:tenant:other-tenant:ws:>\n"
        "SELECT * WHERE { GRAPH ws:evil { ?s ?p ?o } }"
    )
    validate_query(query)  # must not raise


def test_sparql_variable_named_graph_without_graph_clause_still_unscoped() -> None:
    """A variable literally named `?graph` is not a GRAPH clause -- must
    still be rejected as unscoped, not accidentally accepted by a naive
    string check on the word "graph".
    """
    with pytest.raises(UnscopedQueryError):
        validate_query("SELECT * WHERE { ?graph ?p ?o }")


def test_sparql_update_statement_disallowed() -> None:
    """SPARQL Update (INSERT DATA) must never reach the store through
    this read-only choke point.
    """
    with pytest.raises(DisallowedQueryError):
        validate_query(
            'INSERT DATA { GRAPH <urn:weave:tenant:acme-corp:ws:1> { <urn:s> <urn:p> "x" } }'
        )


def test_sparql_nested_service_disallowed() -> None:
    """SERVICE nested two levels deep (inside a UNION inside a GRAPH
    clause) must still be caught -- the algebra walk must recurse fully,
    not just check the top-level pattern.
    """
    with pytest.raises(DisallowedQueryError):
        validate_query(
            "SELECT * WHERE { GRAPH ?g { "
            "{ ?s ?p ?o } UNION { SERVICE <http://evil.example/sparql> { ?s2 ?p2 ?o2 } } "
            "} }"
        )


def test_sparql_from_clause_disallowed() -> None:
    """PR #11 finding (1b): `FROM`/`FROM NAMED` dataset clauses were never
    inspected or stripped -- a trailing triple pattern would evaluate
    against whatever graph the attacker names in `FROM`, regardless of the
    tenant's own scope. Reject outright rather than trying to strip it.
    """
    with pytest.raises(DisallowedQueryError):
        validate_query(
            "SELECT * FROM <urn:weave:tenant:other-tenant:ws:evil> WHERE { ?s ?p ?o }"
        )
    with pytest.raises(DisallowedQueryError):
        validate_query(
            "SELECT * FROM NAMED <urn:weave:tenant:other-tenant:ws:evil> "
            "WHERE { GRAPH ?g { ?s ?p ?o } }"
        )


def test_sparql_service_federation_raises_service_blocked_error() -> None:
    """AC-003-06: SERVICE gets its own error shape (`service_blocked`),
    distinct from AC-003-05's generic `prohibited_clause` -- the router
    must be able to tell them apart without string-matching the message.
    """
    with pytest.raises(ServiceBlockedError):
        validate_query(
            "SELECT * WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> { ?s ?p ?o } } }"
        )


def test_sparql_insert_data_raises_prohibited_clause_error_named_insert() -> None:
    """AC-003-05: an INSERT DATA statement must be identifiable as an
    `INSERT` clause (not just a generic "unparseable" rejection) so the
    router can return `{error: "prohibited_clause", clause: "INSERT"}`.
    """
    with pytest.raises(ProhibitedClauseError) as exc_info:
        validate_query(
            'INSERT DATA { GRAPH <urn:weave:tenant:acme-corp:ws:1> { <urn:s> <urn:p> "x" } }'
        )
    assert exc_info.value.clause == "INSERT"


def test_sparql_delete_data_raises_prohibited_clause_error_named_delete() -> None:
    with pytest.raises(ProhibitedClauseError) as exc_info:
        validate_query(
            'DELETE DATA { GRAPH <urn:weave:tenant:acme-corp:ws:1> { <urn:s> <urn:p> "x" } }'
        )
    assert exc_info.value.clause == "DELETE"


def test_sparql_modify_statement_raises_prohibited_clause_error_named_update() -> None:
    """A `DELETE {...} INSERT {...} WHERE {...}` Modify form is neither a
    pure INSERT nor a pure DELETE -- reported as the generic `UPDATE` label.
    """
    with pytest.raises(ProhibitedClauseError) as exc_info:
        validate_query(
            "DELETE { ?s ?p ?o } INSERT { ?s ?p \"y\" } "
            "WHERE { GRAPH <urn:weave:tenant:acme-corp:ws:1> { ?s ?p ?o } }"
        )
    assert exc_info.value.clause == "UPDATE"


def test_prohibited_clause_error_is_a_disallowed_query_error() -> None:
    """Backward compatibility: existing callers catching the broad
    `DisallowedQueryError` (e.g. `routers/search.py`) must keep working
    unchanged -- both new error types are subclasses, never a parallel
    hierarchy.
    """
    assert issubclass(ProhibitedClauseError, DisallowedQueryError)
    assert issubclass(ServiceBlockedError, DisallowedQueryError)
