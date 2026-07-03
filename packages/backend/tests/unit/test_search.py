"""PLAT-TASK-005 AC-3: search-query building + sanitisation, unit-level
(pure functions, no network -- see tests/integration/test_search.py for the
real-Oxigraph tenant-scoping proof).
"""

from __future__ import annotations

from weave_backend.rdf.query_rewriter import validate_query
from weave_backend.search.sparql_search import (
    MIN_QUERY_LENGTH,
    build_search_query,
    sanitize_search_term,
)


def test_sanitize_search_term_strips_sparql_injection_characters() -> None:
    """Law 13: `< > " { } ;` are stripped before the term ever reaches the
    query text -- these are exactly the characters that could close the
    `"..."` string literal (`"`) or open a new clause (`<>`, `{}`, `;`).
    """
    assert sanitize_search_term('a<b>c"d{e}f;g') == "abcdefg"


def test_sanitize_search_term_leaves_ordinary_text_untouched() -> None:
    assert sanitize_search_term("Acme Corp v2.1") == "Acme Corp v2.1"


def test_build_search_query_disarms_bracketed_iri_injection() -> None:
    """A malicious term trying to close the string literal and splice in a
    second GRAPH clause naming an attacker-chosen graph can't survive: the
    bracket-delimited IRI-reference form is gone (stripped), so it can only
    ever land as inert text still inside the one literal we control.
    """
    injection = '" } GRAPH <urn:weave:tenant:other:ws:evil> { ?s ?p ?o FILTER(true'
    query = build_search_query(injection)

    validate_query(query)  # still one ordinary, well-formed GRAPH-scoped query
    assert "<urn:weave:tenant:other:ws:evil>" not in query
    assert sanitize_search_term(injection) in query


def test_build_search_query_embeds_case_insensitive_contains_filter() -> None:
    query = build_search_query("acme")
    assert "LCASE" in query
    assert "CONTAINS" in query


def test_min_query_length_is_two() -> None:
    assert MIN_QUERY_LENGTH == 2
