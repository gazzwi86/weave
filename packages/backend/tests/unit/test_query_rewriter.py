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
