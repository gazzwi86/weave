"""AC-6: the SPARQL choke point rejects anything not scoped to a single
named graph *before* it reaches Oxigraph, using real algebra parsing
(rdflib) rather than string matching.
"""

from __future__ import annotations

import pytest

from weave_backend.rdf.query_rewriter import (
    DisallowedQueryError,
    UnscopedQueryError,
    rewrite_query,
)

_GRAPH_IRI = "urn:weave:tenant:acme-corp:ws:11111111-1111-1111-1111-111111111111"


def test_sparql_unscoped_query_rejected() -> None:
    with pytest.raises(UnscopedQueryError):
        rewrite_query("SELECT * WHERE { ?s ?p ?o }", _GRAPH_IRI)


def test_sparql_query_rewritten_to_named_graph() -> None:
    rewritten = rewrite_query(
        "SELECT * WHERE { GRAPH <urn:whatever:caller-supplied> { ?s ?p ?o } }",
        _GRAPH_IRI,
    )

    assert f"GRAPH <{_GRAPH_IRI}>" in rewritten
    assert "urn:whatever:caller-supplied" not in rewritten


def test_sparql_construct_query_allowed() -> None:
    rewritten = rewrite_query(
        "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s ?p ?o } }",
        _GRAPH_IRI,
    )

    assert f"GRAPH <{_GRAPH_IRI}>" in rewritten


def test_sparql_ask_query_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        rewrite_query("ASK { GRAPH ?g { ?s ?p ?o } }", _GRAPH_IRI)


def test_sparql_service_federation_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        rewrite_query(
            "SELECT * WHERE { GRAPH ?g { SERVICE <http://evil.example/sparql> { ?s ?p ?o } } }",
            _GRAPH_IRI,
        )


def test_sparql_unparseable_query_disallowed() -> None:
    with pytest.raises(DisallowedQueryError):
        rewrite_query("not a sparql query at all", _GRAPH_IRI)


def test_sparql_comment_containing_graph_does_not_bypass_scoping() -> None:
    """QA edge case (AC-6): a decoy `GRAPH` mention inside a `#` comment
    must not confuse the algebra-based scope decision, and the mechanical
    regex rewrite step (which operates on the raw query text, not the
    algebra) must not leave the decoy pointing at any graph other than
    the caller's own -- no way to smuggle a second, unscoped graph
    reference past the rewrite by hiding it in a comment.
    """
    query = (
        "# GRAPH <urn:weave:tenant:other-tenant:ws:evil>\n"
        "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }"
    )

    rewritten = rewrite_query(query, _GRAPH_IRI)

    assert "other-tenant" not in rewritten
    assert rewritten.count(f"GRAPH <{_GRAPH_IRI}>") == 2  # comment + real clause, both rewritten

    from rdflib.plugins.sparql.algebra import translateQuery
    from rdflib.plugins.sparql.parser import parseQuery

    # Re-parsing must still succeed and resolve to a single allowed, scoped
    # query -- confirms the rewrite didn't corrupt the query shape.
    assert translateQuery(parseQuery(rewritten)).algebra.name == "SelectQuery"


def test_sparql_variable_named_graph_without_graph_clause_still_unscoped() -> None:
    """A variable literally named `?graph` is not a GRAPH clause -- must
    still be rejected as unscoped, not accidentally accepted by a naive
    string check on the word "graph".
    """
    with pytest.raises(UnscopedQueryError):
        rewrite_query("SELECT * WHERE { ?graph ?p ?o }", _GRAPH_IRI)


def test_sparql_update_statement_disallowed() -> None:
    """SPARQL Update (INSERT DATA) must never reach the store through
    this read-only choke point.
    """
    with pytest.raises(DisallowedQueryError):
        rewrite_query(
            'INSERT DATA { GRAPH <urn:weave:tenant:acme-corp:ws:1> { <urn:s> <urn:p> "x" } }',
            _GRAPH_IRI,
        )


def test_sparql_nested_service_disallowed() -> None:
    """SERVICE nested two levels deep (inside a UNION inside a GRAPH
    clause) must still be caught -- the algebra walk must recurse fully,
    not just check the top-level pattern.
    """
    with pytest.raises(DisallowedQueryError):
        rewrite_query(
            "SELECT * WHERE { GRAPH ?g { "
            "{ ?s ?p ?o } UNION { SERVICE <http://evil.example/sparql> { ?s2 ?p2 ?o2 } } "
            "} }",
            _GRAPH_IRI,
        )
